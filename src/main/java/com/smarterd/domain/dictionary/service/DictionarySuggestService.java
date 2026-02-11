package com.smarterd.domain.dictionary.service;

import com.smarterd.api.dictionary.dto.SuggestMatch;
import com.smarterd.api.dictionary.dto.SuggestRequest;
import com.smarterd.api.dictionary.dto.SuggestResponse;
import com.smarterd.domain.dictionary.entity.Term;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 키워드 기반 물리명/도메인 추천 서비스.
 *
 * <p>한글 키워드를 토큰으로 분리한 뒤, 팀의 용어 사전과 매칭하여
 * 물리명 조합과 도메인 추천을 제공한다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DictionarySuggestService {

    /** 용어 레포지토리 */
    private final TermRepository termRepository;

    /** 도메인 레포지토리 */
    private final DomainRepository domainRepository;

    /** 인증 서비스 (사용자 조회) */
    private final AuthService authService;

    /** 팀 서비스 (팀 조회, 멤버십 확인) */
    private final TeamService teamService;

    /** 토큰 수 최대 제한 */
    private static final int MAX_TOKENS = 10;

    /**
     * 한글 키워드에서 물리명과 도메인을 추천한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param request 추천 요청
     * @return 추천 응답
     */
    public SuggestResponse suggest(String loginId, Long teamId, SuggestRequest request) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        final var keyword = request.keyword().trim();
        if (keyword.length() < 2) {
            return new SuggestResponse(null, null, null, List.of());
        }

        // 토큰 분리 (최대 MAX_TOKENS개)
        final var tokens = Arrays.stream(keyword.split("\\s+"))
            .filter((t) -> !t.isBlank())
            .limit(MAX_TOKENS)
            .toList();

        if (tokens.isEmpty()) {
            return new SuggestResponse(null, null, null, List.of());
        }

        // 1. 배치 완전 일치 조회 (1회 쿼리)
        final var exactMatchMap = buildExactMatchMap(team, tokens);

        // 2. 완전 일치 실패 토큰 → 배치 부분 매칭용 팀 전체 용어 조회 (필요 시 1회 쿼리)
        final var unmatchedTokens = tokens
            .stream()
            .filter((t) -> !exactMatchMap.containsKey(t))
            .toList();
        final var allTerms = unmatchedTokens.isEmpty() ? List.<Term>of() : termRepository.findByTeam(team);

        // 토큰별 매칭 결과 조합
        final var matches = new ArrayList<SuggestMatch>();
        final var physicalParts = new ArrayList<String>();

        for (final var token : tokens) {
            final var exactTerm = exactMatchMap.get(token);
            if (exactTerm != null) {
                physicalParts.add(exactTerm.getPhysicalName());
                matches.add(
                    new SuggestMatch(
                        token,
                        true,
                        exactTerm.getPhysicalName(),
                        "용어: " + token + " → " + exactTerm.getPhysicalName()
                    )
                );
                continue;
            }

            // 인메모리 부분 일치 매칭
            final var partialTerm = allTerms
                .stream()
                .filter((t) -> t.getLogicalName().contains(token))
                .findFirst()
                .orElse(null);

            if (partialTerm != null) {
                physicalParts.add(partialTerm.getPhysicalName());
                matches.add(
                    new SuggestMatch(
                        token,
                        true,
                        partialTerm.getPhysicalName(),
                        "용어(부분 일치): " + partialTerm.getLogicalName() + " → " + partialTerm.getPhysicalName()
                    )
                );
                continue;
            }

            matches.add(new SuggestMatch(token, false, null, null));
        }

        // 물리명 조합
        final var physicalName = physicalParts.isEmpty() ? null : String.join("_", physicalParts);

        // 도메인 추천: 마지막 토큰 + 전체 키워드로 배치 조회 (1회 쿼리)
        Long domainId = null;
        String domainLogicalName = null;

        final var lastToken = tokens.getLast().trim();
        final var domainSearchKeys = lastToken.equals(keyword) ? List.of(keyword) : List.of(lastToken, keyword);
        final var domainMatches = domainRepository.findByTeamAndLogicalNameIn(team, domainSearchKeys);

        if (!domainMatches.isEmpty()) {
            // 마지막 토큰 우선, 없으면 전체 키워드 매칭
            final var domain = domainMatches
                .stream()
                .filter((d) -> d.getLogicalName().equals(lastToken))
                .findFirst()
                .orElse(domainMatches.getFirst());
            domainId = domain.getId();
            domainLogicalName = domain.getLogicalName();
        }

        return new SuggestResponse(physicalName, domainId, domainLogicalName, matches);
    }

    /**
     * 토큰 목록으로 완전 일치 용어를 배치 조회하여 맵으로 반환한다.
     *
     * @param team   팀 엔티티
     * @param tokens 토큰 목록
     * @return 논리명 → 용어 맵
     */
    private Map<String, Term> buildExactMatchMap(Team team, List<String> tokens) {
        return termRepository
            .findByTeamAndLogicalNameIn(team, tokens)
            .stream()
            .collect(Collectors.toMap(Term::getLogicalName, Function.identity()));
    }
}
