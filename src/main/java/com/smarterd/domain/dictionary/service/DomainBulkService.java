package com.smarterd.domain.dictionary.service;

import com.smarterd.api.dictionary.dto.BulkDomainRow;
import com.smarterd.api.dictionary.dto.BulkDomainSaveRequest;
import com.smarterd.api.dictionary.dto.BulkSaveResponse;
import com.smarterd.api.dictionary.dto.BulkValidationResponse;
import com.smarterd.api.dictionary.dto.BulkValidationRow;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import com.smarterd.utils.ExcelUtils;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 도메인 일괄 업로드 서비스.
 *
 * <p>엑셀/CSV 파일에서 도메인 데이터를 파싱하고 검증하며, 검증 통과한 도메인을 일괄 저장한다.
 * 기존 {@link DomainService}와 책임을 분리하여 단일 책임 원칙을 유지한다.</p>
 */
@Slf4j
@Service
@Transactional(readOnly = true)
public class DomainBulkService extends AbstractBulkService<DomainBulkService.DomainUploadRow> {

    private static final int PHYSICAL_TYPE_MAX = 50;

    /** 도메인 레포지토리 */
    private final DomainRepository domainRepository;

    /**
     * @param domainRepository 도메인 레포지토리
     * @param authService      인증 서비스
     * @param teamService      팀 서비스
     * @param messageSource    메시지 소스
     */
    public DomainBulkService(
        DomainRepository domainRepository,
        AuthService authService,
        TeamService teamService,
        MessageSource messageSource
    ) {
        super(authService, teamService, messageSource);
        this.domainRepository = domainRepository;
    }

    @Override
    protected Class<DomainUploadRow> uploadRowClass() {
        return DomainUploadRow.class;
    }

    @Override
    protected Map<String, String> mapUploadRow(DomainUploadRow row) {
        final var map = new HashMap<String, String>();
        map.put("logicalName", nullToEmpty(row.getLogicalName()));
        map.put("physicalType", nullToEmpty(row.getPhysicalType()));
        map.put("description", nullToEmpty(row.getDescription()));
        return map;
    }

    @Override
    protected Map<String, String> mapCsvFields(String[] fields) {
        final var map = new HashMap<String, String>();
        map.put("logicalName", fields.length > 0 ? fields[0] : "");
        map.put("physicalType", fields.length > 1 ? fields[1] : "");
        map.put("description", fields.length > 2 ? fields[2] : "");
        return map;
    }

    /**
     * 업로드 파일에서 도메인 데이터를 파싱하고 검증한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param file    업로드 파일 (.xlsx 또는 .csv)
     * @param locale  요청 로케일
     * @return 검증 결과 응답
     */
    public BulkValidationResponse validateUpload(String loginId, Long teamId, MultipartFile file, Locale locale) {
        final var team = verifyTeamAccess(loginId, teamId);

        final var fileName = file.getOriginalFilename();
        final var rawRows = parseFile(file, fileName);

        validateRowCount(rawRows);

        // DB 기존 논리명 일괄 조회
        final var logicalNames = rawRows
            .stream()
            .map((row) -> row.getOrDefault("logicalName", ""))
            .toList();
        final var existingNames = domainRepository
            .findByTeamAndLogicalNameIn(team, logicalNames)
            .stream()
            .map(Domain::getLogicalName)
            .collect(Collectors.toSet());

        // 파일 내 중복 추적
        final var seenNames = new HashSet<String>();
        final var validationRows = new ArrayList<BulkValidationRow>();
        var validCount = 0;

        for (var i = 0; i < rawRows.size(); i++) {
            final var row = rawRows.get(i);
            final var errors = new ArrayList<String>();
            final var logicalName = row.getOrDefault("logicalName", "").trim();
            final var physicalType = row.getOrDefault("physicalType", "").trim();
            final var description = row.getOrDefault("description", "").trim();

            // 필수 필드 검증
            if (logicalName.isBlank()) {
                errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_LOGICAL_NAME_REQUIRED.code(), locale));
            } else if (logicalName.length() > LOGICAL_NAME_MAX) {
                errors.add(
                    msg(MessageCode.ERROR_BULK_VALIDATION_LOGICAL_NAME_MAX_LENGTH.code(), locale, LOGICAL_NAME_MAX)
                );
            }

            if (physicalType.isBlank()) {
                errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_PHYSICAL_TYPE_REQUIRED.code(), locale));
            } else if (physicalType.length() > PHYSICAL_TYPE_MAX) {
                errors.add(
                    msg(MessageCode.ERROR_BULK_VALIDATION_PHYSICAL_TYPE_MAX_LENGTH.code(), locale, PHYSICAL_TYPE_MAX)
                );
            }

            if (description.length() > DESCRIPTION_MAX) {
                errors.add(
                    msg(MessageCode.ERROR_BULK_VALIDATION_DESCRIPTION_MAX_LENGTH.code(), locale, DESCRIPTION_MAX)
                );
            }

            // 파일 내 중복 체크
            if (!logicalName.isBlank() && !seenNames.add(logicalName)) {
                errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DUPLICATE_IN_FILE.code(), locale, logicalName));
            }

            // DB 중복 체크
            if (!logicalName.isBlank() && existingNames.contains(logicalName)) {
                errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DUPLICATE_IN_DB.code(), locale, logicalName));
            }

            final var data = new LinkedHashMap<String, String>();
            data.put("logicalName", logicalName);
            data.put("physicalType", physicalType);
            data.put("description", description);

            final var valid = errors.isEmpty();
            if (valid) {
                validCount++;
            }
            validationRows.add(new BulkValidationRow(i + 2, valid, errors, data));
        }

        return new BulkValidationResponse(rawRows.size(), validCount, rawRows.size() - validCount, validationRows);
    }

    /**
     * 검증 통과한 도메인을 일괄 저장한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param request 도메인 일괄 저장 요청
     * @return 저장 결과 응답
     */
    @Transactional
    public BulkSaveResponse bulkSave(String loginId, Long teamId, BulkDomainSaveRequest request) {
        final var team = verifyTeamAccess(loginId, teamId);

        // 기존 논리명 일괄 조회 (N+1 방지)
        final var existingNames = domainRepository
            .findByTeamAndLogicalNameIn(team, request.rows().stream().map(BulkDomainRow::logicalName).toList())
            .stream()
            .map(Domain::getLogicalName)
            .collect(Collectors.toSet());

        final var domainsToSave = new ArrayList<Domain>();
        var failedCount = 0;

        for (BulkDomainRow row : request.rows()) {
            if (existingNames.contains(row.logicalName())) {
                failedCount++;
                continue;
            }
            domainsToSave.add(
                Domain.builder()
                    .logicalName(row.logicalName())
                    .physicalType(row.physicalType())
                    .description(row.description())
                    .team(team)
                    .build()
            );
        }

        try {
            domainRepository.saveAll(domainsToSave);
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateException(MessageCode.ERROR_BULK_CONCURRENT_DUPLICATE.code());
        }
        return new BulkSaveResponse(domainsToSave.size(), failedCount);
    }

    /**
     * 도메인 템플릿 엑셀을 생성한다.
     *
     * <p>Accept-Language 헤더에 따라 컬럼 헤더, 샘플 데이터, 가이드 시트가 해당 언어로 생성된다.</p>
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param locale  요청 로케일
     * @return 엑셀 데이터
     */
    public ExcelUtils.ExcelData generateTemplate(String loginId, Long teamId, Locale locale) {
        verifyTeamAccess(loginId, teamId);

        final var titles = List.of(
            msg("template.domain.col.logical-name", locale),
            msg("template.domain.col.physical-type", locale),
            msg("template.domain.col.description", locale)
        );
        final var templateData = List.of(
            new TemplateRow(
                msg("template.domain.sample.logical-name", locale),
                msg("template.domain.sample.physical-type", locale),
                msg("template.domain.sample.description", locale)
            )
        );
        try (final var utils = new ExcelUtils<>(templateData, titles)) {
            utils.sheetName(msg("template.domain.sheet-name", locale));
            final var excelData = utils.toExcel();
            addGuideSheet(excelData.excelBook(), locale, TemplateType.DOMAIN);
            return excelData;
        } catch (java.io.IOException e) {
            throw new java.io.UncheckedIOException("Failed to release Excel template resources", e);
        }
    }

    /**
     * 엑셀 업로드용 임시 데이터 클래스.
     *
     * <p>ExcelUtils의 setter 기반 추출을 위해 필요한 POJO 클래스.</p>
     */
    public static class DomainUploadRow {

        private String logicalName;
        private String physicalType;
        private String description;

        public String getLogicalName() {
            return logicalName;
        }

        public void setLogicalName(String logicalName) {
            this.logicalName = logicalName;
        }

        public String getPhysicalType() {
            return physicalType;
        }

        public void setPhysicalType(String physicalType) {
            this.physicalType = physicalType;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }
    }

    /**
     * 템플릿 엑셀 생성용 행 데이터 클래스.
     *
     * <p>ExcelUtils가 getter 메서드명 규칙({@code getXxx()})에 의존하므로
     * record로 전환할 수 없다. record의 accessor는 {@code xxx()} 형식이기 때문이다.</p>
     *
     * // TODO: ExcelUtils가 record accessor를 지원하면 record로 전환
     */
    public static class TemplateRow {

        private final String logicalName;
        private final String physicalType;
        private final String description;

        public TemplateRow(String logicalName, String physicalType, String description) {
            this.logicalName = logicalName;
            this.physicalType = physicalType;
            this.description = description;
        }

        public String getLogicalName() {
            return logicalName;
        }

        public String getPhysicalType() {
            return physicalType;
        }

        public String getDescription() {
            return description;
        }
    }
}
