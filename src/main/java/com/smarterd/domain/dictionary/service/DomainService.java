package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.service.AuthService;
import com.smarterd.utils.AppStringUtils;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 도메인(데이터 타입 사전) 관련 비즈니스 로직 서비스.
 *
 * <p>도메인 CRUD를 처리하며, 팀 소속 여부 및 표준 도메인명 중복을 검증한다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DomainService {

    private static final int MAX_PAGE_SIZE = 5_000;

    /** 도메인 레포지토리 */
    private final DomainRepository domainRepository;

    /** 용어 레포지토리 (도메인 삭제 전 참조 확인) */
    private final TermRepository termRepository;

    /** 인증 서비스 (사용자 조회) */
    private final AuthService authService;

    /** 팀 서비스 (팀 조회, 멤버십 확인) */
    private final TeamService teamService;

    /** 사전 세트 서비스 */
    private final DictionarySetService dictionarySetService;

    /**
     * 도메인을 생성한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @param domainGroup 생성할 도메인 그룹
     * @param domainClassification 생성할 도메인명
     * @param logicalName 생성할 표준 도메인명
     * @param physicalType 생성할 호환용 물리 타입
     * @param dataType 생성할 데이터 타입
     * @param dataLength 생성할 데이터 길이
     * @param dataScale 생성할 데이터 소수점 길이
     * @param description 생성할 설명
     * @return 생성된 도메인 결과
     */
    @Transactional
    public DomainResult createDomain(
        String loginId,
        Long teamId,
        Long setId,
        String domainGroup,
        String domainClassification,
        String logicalName,
        String physicalType,
        String dataType,
        Integer dataLength,
        Integer dataScale,
        String description
    ) {
        final var context = verifyWriteAccess(loginId, teamId, setId);
        final var typeComponents = DomainPhysicalTypeSupport.resolve(physicalType, dataType, dataLength, dataScale);
        validateStructuredTypeRules(typeComponents.dataType(), typeComponents.dataLength(), typeComponents.dataScale());
        final var standardLogicalName = DomainLogicalNameSupport.resolve(
            logicalName,
            domainClassification,
            typeComponents.dataType(),
            typeComponents.dataLength(),
            typeComponents.dataScale()
        );

        if (domainRepository.existsByDictionarySetAndLogicalName(context.dictionarySet(), standardLogicalName)) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_DOMAIN_LOGICAL_NAME.code(), standardLogicalName);
        }

        final var domain = Domain.builder()
            .logicalName(standardLogicalName)
            .domainGroup(AppStringUtils.trimToNull(domainGroup))
            .domainClassification(AppStringUtils.trimToNull(domainClassification))
            .dataType(typeComponents.dataType())
            .dataLength(typeComponents.dataLength())
            .dataScale(typeComponents.dataScale())
            .physicalType(typeComponents.physicalType())
            .description(description)
            .team(context.team())
            .dictionarySet(context.dictionarySet())
            .build();
        domainRepository.save(Objects.requireNonNull(domain));

        return toDomainResult(domain);
    }

    /**
     * 팀의 도메인 목록을 조회한다.
     *
     * @param loginId       요청 사용자의 로그인 ID
     * @param teamId        팀 ID
     * @param setId         사전 세트 ID
     * @param page          페이지 번호
     * @param size          페이지 크기
     * @param keyword       복합 검색어
     * @return 도메인 결과 페이지
     */
    public Page<DomainResult> getDomains(String loginId, Long teamId, Long setId, int page, int size, String keyword) {
        final var context = verifyReadAccess(loginId, teamId, setId);

        final var pageable = PageRequest.of(
            Math.max(page, 0),
            Math.min(Math.max(size, 1), MAX_PAGE_SIZE),
            Sort.by(Sort.Order.asc("logicalName"), Sort.Order.asc("id"))
        );
        final var normalizedKeyword = AppStringUtils.trimToNull(keyword);
        final var resultPage = (
            normalizedKeyword == null
                ? domainRepository.findByDictionarySet(context.dictionarySet(), pageable)
                : domainRepository.searchByDictionarySet(context.dictionarySet(), normalizedKeyword, pageable)
        ).map(this::toDomainResult);
        return resultPage;
    }

    /**
     * 엑셀 내보내기용 전체 도메인 목록을 조회한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @return 사전 세트명과 정렬된 도메인 목록
     */
    public DomainExportResult getDomainsForExport(String loginId, Long teamId, Long setId) {
        final var context = verifyReadAccess(loginId, teamId, setId);
        final var domains = domainRepository
            .findByDictionarySetOrderByLogicalNameAscIdAsc(context.dictionarySet())
            .stream()
            .map(this::toDomainResult)
            .toList();
        return new DomainExportResult(context.dictionarySet().getName(), domains);
    }

    /**
     * 도메인 상세를 조회한다.
     *
     * @param loginId  요청 사용자의 로그인 ID
     * @param teamId   팀 ID
     * @param setId    사전 세트 ID
     * @param domainId 도메인 ID
     * @return 도메인 결과
     */
    public DomainResult getDomain(String loginId, Long teamId, Long setId, Long domainId) {
        verifyReadAccess(loginId, teamId, setId);

        final var domain = findDomainById(domainId);
        verifyDomainBelongsToTeam(domain, teamId);
        verifyDomainBelongsToSet(domain, setId);

        return toDomainResult(domain);
    }

    /**
     * 도메인을 수정한다.
     *
     * @param loginId  요청 사용자의 로그인 ID
     * @param teamId   팀 ID
     * @param setId    사전 세트 ID
     * @param domainId 도메인 ID
     * @param domainGroup 변경할 도메인 그룹
     * @param domainClassification 변경할 도메인명
     * @param logicalName 변경할 표준 도메인명
     * @param physicalType 변경할 호환용 물리 타입
     * @param dataType 변경할 데이터 타입
     * @param dataLength 변경할 데이터 길이
     * @param dataScale 변경할 데이터 소수점 길이
     * @param description 변경할 설명
     * @return 수정된 도메인 결과
     */
    @Transactional
    public DomainResult updateDomain(
        String loginId,
        Long teamId,
        Long setId,
        Long domainId,
        String domainGroup,
        String domainClassification,
        String logicalName,
        String physicalType,
        String dataType,
        Integer dataLength,
        Integer dataScale,
        String description
    ) {
        final var context = verifyWriteAccess(loginId, teamId, setId);
        final var typeComponents = DomainPhysicalTypeSupport.resolve(physicalType, dataType, dataLength, dataScale);
        validateStructuredTypeRules(typeComponents.dataType(), typeComponents.dataLength(), typeComponents.dataScale());
        final var standardLogicalName = DomainLogicalNameSupport.resolve(
            logicalName,
            domainClassification,
            typeComponents.dataType(),
            typeComponents.dataLength(),
            typeComponents.dataScale()
        );

        final var domain = findDomainById(domainId);
        verifyDomainBelongsToTeam(domain, teamId);
        verifyDomainBelongsToSet(domain, setId);

        if (
            domainRepository.existsByDictionarySetAndLogicalNameAndIdNot(
                context.dictionarySet(),
                standardLogicalName,
                domainId
            )
        ) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_DOMAIN_LOGICAL_NAME.code(), standardLogicalName);
        }

        domain.update(
            standardLogicalName,
            AppStringUtils.trimToNull(domainGroup),
            AppStringUtils.trimToNull(domainClassification),
            typeComponents.dataType(),
            typeComponents.dataLength(),
            typeComponents.dataScale(),
            typeComponents.physicalType(),
            description
        );

        return toDomainResult(domain);
    }

    /**
     * 도메인을 삭제한다.
     *
     * @param loginId  요청 사용자의 로그인 ID
     * @param teamId   팀 ID
     * @param setId    사전 세트 ID
     * @param domainId 도메인 ID
     */
    @Transactional
    public void deleteDomain(String loginId, Long teamId, Long setId, Long domainId) {
        verifyWriteAccess(loginId, teamId, setId);

        final var domain = Objects.requireNonNull(findDomainById(domainId));
        verifyDomainBelongsToTeam(domain, teamId);
        verifyDomainBelongsToSet(domain, setId);

        final var termCount = termRepository.countByDomain(domain);
        if (termCount > 0) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DOMAIN_IN_USE.code(), termCount);
        }

        domainRepository.delete(domain);
    }

    /**
     * 도메인 ID로 도메인을 조회한다.
     *
     * @param domainId 도메인 ID
     * @return 도메인 엔티티
     * @throws EntityNotFoundException 도메인이 존재하지 않는 경우
     */
    public Domain findDomainById(Long domainId) {
        Objects.requireNonNull(domainId, "domainId must not be null");
        return domainRepository
            .findById(domainId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DOMAIN.code(), domainId));
    }

    // ── 접근 검증 메서드 ──

    /**
     * 읽기 접근을 검증한다. 모든 팀 멤버가 접근 가능하다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @return 검증된 접근 컨텍스트
     */
    private AccessContext verifyReadAccess(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);
        return new AccessContext(user, team, dictionarySet);
    }

    /**
     * 쓰기 접근을 검증한다. ADMIN과 MEMBER만 접근 가능하다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @return 검증된 접근 컨텍스트
     */
    private AccessContext verifyWriteAccess(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);
        return new AccessContext(user, team, dictionarySet);
    }

    // ── 소속 검증 메서드 ──

    /**
     * 도메인이 해당 팀에 소속되어 있는지 확인한다.
     *
     * @param domain 도메인 엔티티
     * @param teamId 팀 ID
     * @throws BusinessException 도메인이 해당 팀에 소속되지 않은 경우
     */
    private void verifyDomainBelongsToTeam(Domain domain, Long teamId) {
        if (!domain.getTeam().getId().equals(teamId)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DOMAIN_TEAM_MISMATCH.code());
        }
    }

    /**
     * 도메인이 요청한 사전 세트에 소속되어 있는지 확인한다.
     *
     * @param domain 도메인 엔티티
     * @param setId  사전 세트 ID
     * @throws BusinessException 도메인이 해당 사전 세트에 소속되지 않은 경우
     */
    private void verifyDomainBelongsToSet(Domain domain, Long setId) {
        if (domain.getDictionarySet() == null || !domain.getDictionarySet().getId().equals(setId)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DICTIONARY_SET_TEAM_MISMATCH.code());
        }
    }

    /**
     * 도메인 엔티티를 서비스 결과로 변환한다.
     *
     * @param domain 도메인 엔티티
     * @return 서비스 계층 도메인 결과
     */
    private DomainResult toDomainResult(Domain domain) {
        final var typeComponents = DomainPhysicalTypeSupport.resolve(
            domain.getPhysicalType(),
            domain.getDataType(),
            domain.getDataLength(),
            domain.getDataScale()
        );
        return new DomainResult(
            domain.getId(),
            domain.getLogicalName(),
            domain.getDomainGroup(),
            domain.getDomainClassification(),
            typeComponents.dataType(),
            typeComponents.dataLength(),
            typeComponents.dataScale(),
            typeComponents.physicalType(),
            domain.getDescription(),
            domain.getTeam().getId(),
            domain.getDictionarySet() != null ? domain.getDictionarySet().getId() : null,
            domain.getCreatedAt(),
            domain.getUpdatedAt()
        );
    }

    private void validateStructuredTypeRules(
        @Nullable String dataType,
        @Nullable Integer dataLength,
        @Nullable Integer dataScale
    ) {
        if (DomainPhysicalTypeSupport.requiresLength(dataType) && dataLength == null) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DOMAIN_DATA_LENGTH_REQUIRED.code());
        }
        if (dataScale != null && dataLength == null) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DOMAIN_DATA_SCALE_REQUIRES_LENGTH.code());
        }
        if (DomainPhysicalTypeSupport.isScaleExceedsLength(dataLength, dataScale)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DOMAIN_DATA_SCALE_INVALID.code());
        }
    }

    /**
     * 접근 검증 결과를 담는 내부 컨텍스트.
     *
     * @param user          인증된 사용자
     * @param team          대상 팀
     * @param dictionarySet 대상 사전 세트
     */
    private record AccessContext(User user, Team team, DictionarySet dictionarySet) {}

    /**
     * 도메인 응답용 서비스 결과.
     *
     * @param id 도메인 ID
     * @param logicalName 공통 표준 도메인명
     * @param domainGroup 도메인 그룹
     * @param domainClassification 도메인명
     * @param dataType 데이터 타입
     * @param dataLength 데이터 길이
     * @param dataScale 데이터 소수점 길이
     * @param physicalType 표시 물리 데이터 타입
     * @param description 설명
     * @param teamId 소속 팀 ID
     * @param dictionarySetId 소속 사전 세트 ID
     * @param createdAt 생성 시각
     * @param updatedAt 수정 시각
     */
    public record DomainResult(
        Long id,
        String logicalName,
        String domainGroup,
        String domainClassification,
        String dataType,
        Integer dataLength,
        Integer dataScale,
        String physicalType,
        String description,
        Long teamId,
        Long dictionarySetId,
        Instant createdAt,
        Instant updatedAt
    ) {}

    /**
     * 도메인 사전 엑셀 내보내기 결과.
     *
     * @param dictionarySetName 사전 세트명
     * @param domains 정렬된 도메인 목록
     */
    public record DomainExportResult(String dictionarySetName, List<DomainResult> domains) {}
}
