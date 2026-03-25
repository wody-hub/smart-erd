package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.repository.DictionarySetRepository;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.utils.AppStringUtils;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 앱 기동 시 도메인 구조화 타입 및 GH 도급 표준 메타데이터를 보정한다.
 *
 * <p>현재 프로젝트는 Hibernate {@code ddl-auto:update}를 사용하므로 별도 마이그레이션 러너가 없다.
 * 이 서비스는 기존 도메인 데이터가 새 구조로 자연스럽게 수렴하도록 최소한의 백필을 수행한다.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DomainStartupBackfillService implements ApplicationRunner {

    private static final String GH_CONTRACT_SET_NAME = "GH 도급";
    private static final Map<String, GhContractDomainMetadata> GH_CONTRACT_DOMAIN_METADATA = createGhContractDomainMetadata();

    private final DomainRepository domainRepository;
    private final DictionarySetRepository dictionarySetRepository;

    @Override
    public void run(ApplicationArguments args) {
        final var summary = backfillMetadataIfNeeded();
        if (summary.structuredTypeUpdates() > 0 || summary.ghContractUpdates() > 0) {
            log.info(
                "Domain startup backfill applied. structuredTypeUpdates={}, ghContractUpdates={}",
                summary.structuredTypeUpdates(),
                summary.ghContractUpdates()
            );
        }
    }

    /**
     * 구조화 타입과 GH 도급 메타데이터를 필요한 경우 보정한다.
     *
     * @return 백필 요약
     */
    @Transactional
    public BackfillSummary backfillMetadataIfNeeded() {
        final var structuredTypeUpdates = backfillStructuredTypes();
        final var ghContractUpdates = backfillGhContractDomains();
        return new BackfillSummary(structuredTypeUpdates, ghContractUpdates);
    }

    private int backfillStructuredTypes() {
        var updatedCount = 0;
        for (final var domain : domainRepository.findAll()) {
            final var typeComponents = DomainPhysicalTypeSupport.resolve(
                domain.getPhysicalType(),
                domain.getDataType(),
                domain.getDataLength(),
                domain.getDataScale()
            );
            final var expectedPhysicalType = AppStringUtils.defaultIfBlank(
                typeComponents.physicalType(),
                domain.getPhysicalType()
            );

            if (
                Objects.equals(domain.getDataType(), typeComponents.dataType()) &&
                Objects.equals(domain.getDataLength(), typeComponents.dataLength()) &&
                Objects.equals(domain.getDataScale(), typeComponents.dataScale()) &&
                Objects.equals(domain.getPhysicalType(), expectedPhysicalType)
            ) {
                continue;
            }

            applyDomainUpdate(
                domain,
                domain.getLogicalName(),
                domain.getDomainGroup(),
                domain.getDomainClassification(),
                typeComponents.dataType(),
                typeComponents.dataLength(),
                typeComponents.dataScale(),
                expectedPhysicalType
            );
            updatedCount++;
        }
        return updatedCount;
    }

    private int backfillGhContractDomains() {
        var updatedCount = 0;
        for (final var dictionarySet : dictionarySetRepository.findByNameOrderByIdAsc(GH_CONTRACT_SET_NAME)) {
            for (final var domain : domainRepository.findByDictionarySetOrderByIdAsc(dictionarySet)) {
                final var metadata = resolveGhContractMetadata(domain);
                if (metadata == null) {
                    continue;
                }

                final var expectedLogicalName = AppStringUtils.defaultIfBlank(
                    DomainLogicalNameSupport.resolve(
                        domain.getLogicalName(),
                        metadata.domainName(),
                        domain.getDataType(),
                        domain.getDataLength(),
                        domain.getDataScale()
                    ),
                    domain.getLogicalName()
                );
                final var expectedPhysicalType = AppStringUtils.defaultIfBlank(
                    DomainPhysicalTypeSupport.format(domain.getDataType(), domain.getDataLength(), domain.getDataScale()),
                    domain.getPhysicalType()
                );

                if (
                    Objects.equals(domain.getLogicalName(), expectedLogicalName) &&
                    Objects.equals(domain.getDomainGroup(), metadata.group()) &&
                    Objects.equals(domain.getDomainClassification(), metadata.domainName()) &&
                    Objects.equals(domain.getPhysicalType(), expectedPhysicalType)
                ) {
                    continue;
                }

                applyDomainUpdate(
                    domain,
                    expectedLogicalName,
                    metadata.group(),
                    metadata.domainName(),
                    domain.getDataType(),
                    domain.getDataLength(),
                    domain.getDataScale(),
                    expectedPhysicalType
                );
                updatedCount++;
            }
        }
        return updatedCount;
    }

    @Nullable
    private GhContractDomainMetadata resolveGhContractMetadata(Domain domain) {
        final var candidates = new java.util.ArrayList<String>();
        candidates.add(AppStringUtils.trimToNull(domain.getDomainClassification()));
        candidates.add(
            DomainLogicalNameSupport.inferDomainName(
                domain.getLogicalName(),
                domain.getDataType(),
                domain.getDataLength(),
                domain.getDataScale()
            )
        );
        candidates.add(AppStringUtils.trimToNull(domain.getLogicalName()));

        for (final var candidate : candidates) {
            final var normalizedKey = normalizeDomainKey(candidate);
            if (normalizedKey == null) {
                continue;
            }
            final var metadata = GH_CONTRACT_DOMAIN_METADATA.get(normalizedKey);
            if (metadata != null) {
                return metadata;
            }
        }
        return null;
    }

    private void applyDomainUpdate(
        Domain domain,
        String logicalName,
        @Nullable String domainGroup,
        @Nullable String domainClassification,
        @Nullable String dataType,
        @Nullable Integer dataLength,
        @Nullable Integer dataScale,
        String physicalType
    ) {
        domain.update(
            logicalName,
            domainGroup,
            domainClassification,
            dataType,
            dataLength,
            dataScale,
            physicalType,
            domain.getDescription()
        );
    }

    @Nullable
    private static String normalizeDomainKey(@Nullable String value) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized == null) {
            return null;
        }
        return normalized.replaceAll("\\s+", "").toUpperCase(java.util.Locale.ROOT);
    }

    private static Map<String, GhContractDomainMetadata> createGhContractDomainMetadata() {
        final Map<String, GhContractDomainMetadata> metadata = new LinkedHashMap<>();

        register(metadata, "수치", "분");
        register(metadata, "수치", "수");
        register(metadata, "수치", "금액");
        register(metadata, "명칭", "내용");
        register(metadata, "수치", "레벨");
        register(metadata, "명칭", "설명");
        register(metadata, "수치", "순서");
        register(metadata, "일시", "시간");
        register(metadata, "일시", "연도");
        register(metadata, "일시", "일시");
        register(metadata, "일시", "일자");
        register(metadata, "수치", "점수");
        register(metadata, "수치", "횟수");
        register(metadata, "식별자", "고유번호");
        register(metadata, "수치", "소요시간");
        register(metadata, "수치", "시퀀스값");
        register(metadata, "수치", "파일사이즈");
        register(metadata, "식별자", "이메일템플릿아이디");
        register(metadata, "연락/경로", "IP주소");
        register(metadata, "특수", "JSONB");
        register(metadata, "식별자", "sms 요청아이디", "sms요청아이디");
        register(metadata, "식별자", "SR아이디");
        register(metadata, "연락/경로", "URL");
        register(metadata, "여부/상태", "여부");
        register(metadata, "식별자", "추적아이디");
        register(metadata, "보안", "초대토큰");
        register(metadata, "명칭", "직급");
        register(metadata, "명칭", "안전보건대책");
        register(metadata, "명칭", "유해위험요인");
        register(metadata, "명칭", "임무내용");
        register(metadata, "명칭", "작업구역");
        register(metadata, "연락/경로", "파일경로");
        register(metadata, "명칭", "속성값", "속성값_v1000", "속성값_V1000");
        register(metadata, "명칭", "의무");
        register(metadata, "식별자", "사업자등록번호");
        register(metadata, "식별자", "작업종류아이디");
        register(metadata, "식별자", "공종아이디");
        register(metadata, "연락/경로", "전화번호");
        register(metadata, "식별자", "코드");
        register(metadata, "보안", "비밀번호솔트");
        register(metadata, "식별자", "사용자아이디");
        register(metadata, "보안", "비밀번호");
        register(metadata, "연락/경로", "이메일");
        register(metadata, "명칭", "제목");
        register(metadata, "명칭", "직위");
        register(metadata, "명칭", "명");
        register(metadata, "식별자", "알림템플릿아이디");
        register(metadata, "식별자", "결재소스아이디");
        register(metadata, "식별자", "코드그룹아이디");
        register(metadata, "식별자", "파일문서아이디");
        register(metadata, "식별자", "메뉴아이디");
        register(metadata, "식별자", "부서아이디");
        register(metadata, "식별자", "조직아이디");
        register(metadata, "식별자", "파일 아이디", "파일아이디");
        register(metadata, "식별자", "현장아이디");
        register(metadata, "명칭", "적용 범위", "적용범위");
        register(metadata, "식별자", "파일업로드아이디");
        register(metadata, "명칭", "이행평가 항목명", "이행평가항목명");
        register(metadata, "명칭", "사용자정보");
        register(metadata, "명칭", "훈련대상");
        register(metadata, "명칭", "장소");
        register(metadata, "명칭", "주소");
        register(metadata, "일시", "연월");

        return metadata;
    }

    private static void register(
        Map<String, GhContractDomainMetadata> metadata,
        String group,
        String domainName,
        String... aliases
    ) {
        final var domainMetadata = new GhContractDomainMetadata(group, domainName);
        metadata.put(Objects.requireNonNull(normalizeDomainKey(domainName)), domainMetadata);
        for (final var alias : aliases) {
            metadata.put(Objects.requireNonNull(normalizeDomainKey(alias)), domainMetadata);
        }
    }

    /**
     * 백필 요약.
     *
     * @param structuredTypeUpdates 구조화 타입 보정 건수
     * @param ghContractUpdates GH 도급 메타데이터 보정 건수
     */
    public record BackfillSummary(int structuredTypeUpdates, int ghContractUpdates) {}

    private record GhContractDomainMetadata(String group, String domainName) {}
}
