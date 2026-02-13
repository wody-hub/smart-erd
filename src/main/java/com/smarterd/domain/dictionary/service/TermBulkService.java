package com.smarterd.domain.dictionary.service;

import com.smarterd.api.dictionary.dto.BulkSaveResponse;
import com.smarterd.api.dictionary.dto.BulkTermRow;
import com.smarterd.api.dictionary.dto.BulkTermSaveRequest;
import com.smarterd.api.dictionary.dto.BulkValidationResponse;
import com.smarterd.api.dictionary.dto.BulkValidationRow;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.entity.Term;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
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
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 용어 일괄 업로드 서비스.
 *
 * <p>엑셀/CSV 파일에서 용어 데이터를 파싱하고 검증하며, 검증 통과한 용어를 일괄 저장한다.
 * 기존 {@link TermService}와 책임을 분리하여 단일 책임 원칙을 유지한다.</p>
 */
@Slf4j
@Service
@Transactional(readOnly = true)
public class TermBulkService extends AbstractBulkService<TermBulkService.TermUploadRow> {

    private static final int PHYSICAL_NAME_MAX = 100;

    /** 용어 레포지토리 */
    private final TermRepository termRepository;

    /** 도메인 레포지토리 (도메인 논리명 매핑) */
    private final DomainRepository domainRepository;

    /** 사전 세트 서비스 */
    private final DictionarySetService dictionarySetService;

    /**
     * @param termRepository   용어 레포지토리
     * @param domainRepository 도메인 레포지토리
     * @param authService      인증 서비스
     * @param teamService      팀 서비스
     * @param messageSource    메시지 소스
     */
    public TermBulkService(
        TermRepository termRepository,
        DomainRepository domainRepository,
        DictionarySetService dictionarySetService,
        AuthService authService,
        TeamService teamService,
        MessageSource messageSource
    ) {
        super(authService, teamService, messageSource);
        this.termRepository = termRepository;
        this.domainRepository = domainRepository;
        this.dictionarySetService = dictionarySetService;
    }

    @Override
    protected Class<TermUploadRow> uploadRowClass() {
        return TermUploadRow.class;
    }

    @Override
    protected Map<String, String> mapUploadRow(TermUploadRow row) {
        final var map = new HashMap<String, String>();
        map.put("logicalName", nullToEmpty(row.getLogicalName()));
        map.put("physicalName", nullToEmpty(row.getPhysicalName()));
        map.put("domainLogicalName", nullToEmpty(row.getDomainLogicalName()));
        map.put("description", nullToEmpty(row.getDescription()));
        return map;
    }

    @Override
    protected Map<String, String> mapCsvFields(String[] fields) {
        final var map = new HashMap<String, String>();
        map.put("logicalName", fields.length > 0 ? fields[0] : "");
        map.put("physicalName", fields.length > 1 ? fields[1] : "");
        map.put("domainLogicalName", fields.length > 2 ? fields[2] : "");
        map.put("description", fields.length > 3 ? fields[3] : "");
        return map;
    }

    /**
     * 업로드 파일에서 용어 데이터를 파싱하고 검증한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param file    업로드 파일 (.xlsx 또는 .csv)
     * @param locale  요청 로케일
     * @return 검증 결과 응답
     */
    public BulkValidationResponse validateUpload(
        String loginId,
        Long teamId,
        Long setId,
        MultipartFile file,
        Locale locale
    ) {
        final var team = verifyTeamAccess(loginId, teamId);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);

        final var fileName = file.getOriginalFilename();
        final var rawRows = parseFile(file, fileName);

        validateRowCount(rawRows);

        // DB 기존 논리명 일괄 조회
        final var logicalNames = rawRows
            .stream()
            .map((row) -> row.getOrDefault("logicalName", ""))
            .toList();
        final var existingNames = termRepository
            .findByDictionarySetAndLogicalNameIn(dictionarySet, logicalNames)
            .stream()
            .map(Term::getLogicalName)
            .collect(Collectors.toSet());

        // 팀 내 도메인 논리명 맵 구축
        final var domainMap = domainRepository
            .findByDictionarySet(dictionarySet)
            .stream()
            .collect(Collectors.toMap(Domain::getLogicalName, Function.identity()));

        // 파일 내 중복 추적
        final var seenNames = new HashSet<String>();
        final var validationRows = new ArrayList<BulkValidationRow>();
        var validCount = 0;

        for (var i = 0; i < rawRows.size(); i++) {
            final var row = rawRows.get(i);
            final var errors = new ArrayList<String>();
            final var logicalName = row.getOrDefault("logicalName", "").trim();
            final var physicalName = row.getOrDefault("physicalName", "").trim();
            final var domainLogicalName = row.getOrDefault("domainLogicalName", "").trim();
            final var description = row.getOrDefault("description", "").trim();

            // 필수 필드 검증
            if (logicalName.isBlank()) {
                errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_LOGICAL_NAME_REQUIRED.code(), locale));
            } else if (logicalName.length() > LOGICAL_NAME_MAX) {
                errors.add(
                    msg(MessageCode.ERROR_BULK_VALIDATION_LOGICAL_NAME_MAX_LENGTH.code(), locale, LOGICAL_NAME_MAX)
                );
            }

            if (physicalName.isBlank()) {
                errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_PHYSICAL_NAME_REQUIRED.code(), locale));
            } else if (physicalName.length() > PHYSICAL_NAME_MAX) {
                errors.add(
                    msg(MessageCode.ERROR_BULK_VALIDATION_PHYSICAL_NAME_MAX_LENGTH.code(), locale, PHYSICAL_NAME_MAX)
                );
            }

            if (description.length() > DESCRIPTION_MAX) {
                errors.add(
                    msg(MessageCode.ERROR_BULK_VALIDATION_DESCRIPTION_MAX_LENGTH.code(), locale, DESCRIPTION_MAX)
                );
            }

            // 도메인 논리명 검증
            if (!domainLogicalName.isBlank() && !domainMap.containsKey(domainLogicalName)) {
                errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DOMAIN_NOT_FOUND.code(), locale, domainLogicalName));
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
            data.put("physicalName", physicalName);
            data.put("domainLogicalName", domainLogicalName);
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
     * 검증 통과한 용어를 일괄 저장한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param request 용어 일괄 저장 요청
     * @return 저장 결과 응답
     */
    @Transactional
    public BulkSaveResponse bulkSave(String loginId, Long teamId, Long setId, BulkTermSaveRequest request) {
        final var team = verifyTeamAccess(loginId, teamId);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);

        // 도메인 논리명 → 엔티티 맵
        final var domainMap = domainRepository
            .findByDictionarySet(dictionarySet)
            .stream()
            .collect(Collectors.toMap(Domain::getLogicalName, Function.identity()));

        // 기존 논리명 일괄 조회 (N+1 방지)
        final var existingNames = termRepository
            .findByDictionarySetAndLogicalNameIn(
                dictionarySet,
                request.rows().stream().map(BulkTermRow::logicalName).toList()
            )
            .stream()
            .map(Term::getLogicalName)
            .collect(Collectors.toSet());

        final var termsToSave = new ArrayList<Term>();
        var failedCount = 0;

        for (BulkTermRow row : request.rows()) {
            if (existingNames.contains(row.logicalName())) {
                failedCount++;
                continue;
            }

            Domain domain = null;
            if (row.domainLogicalName() != null && !row.domainLogicalName().isBlank()) {
                domain = domainMap.get(row.domainLogicalName());
            }

            termsToSave.add(
                Term.builder()
                    .logicalName(row.logicalName())
                    .physicalName(row.physicalName())
                    .description(row.description())
                    .team(team)
                    .dictionarySet(dictionarySet)
                    .domain(domain)
                    .build()
            );
        }

        try {
            termRepository.saveAll(termsToSave);
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateException(MessageCode.ERROR_BULK_CONCURRENT_DUPLICATE.code());
        }
        return new BulkSaveResponse(termsToSave.size(), failedCount);
    }

    /**
     * 용어 템플릿 엑셀을 생성한다.
     *
     * <p>Accept-Language 헤더에 따라 컬럼 헤더, 샘플 데이터, 가이드 시트가 해당 언어로 생성된다.</p>
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param locale  요청 로케일
     * @return 엑셀 데이터
     */
    public ExcelUtils.ExcelData generateTemplate(String loginId, Long teamId, Long setId, Locale locale) {
        final var team = verifyTeamAccess(loginId, teamId);
        dictionarySetService.findByTeamAndId(team, setId);

        final var titles = List.of(
            msg("template.term.col.logical-name", locale),
            msg("template.term.col.physical-name", locale),
            msg("template.term.col.domain-logical-name", locale),
            msg("template.term.col.description", locale)
        );
        final var templateData = List.of(
            new TemplateRow(
                msg("template.term.sample.logical-name", locale),
                msg("template.term.sample.physical-name", locale),
                msg("template.term.sample.domain-logical-name", locale),
                msg("template.term.sample.description", locale)
            )
        );
        try (final var utils = new ExcelUtils<>(templateData, titles)) {
            utils.sheetName(msg("template.term.sheet-name", locale));
            final var excelData = utils.toExcel();
            addGuideSheet(excelData.excelBook(), locale, TemplateType.TERM);
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
    @Getter
    @Setter
    public static class TermUploadRow {

        private String logicalName;
        private String physicalName;
        private String domainLogicalName;
        private String description;
    }

    /** 템플릿 엑셀 생성용 행 데이터. */
    public record TemplateRow(String logicalName, String physicalName, String domainLogicalName, String description) {}
}
