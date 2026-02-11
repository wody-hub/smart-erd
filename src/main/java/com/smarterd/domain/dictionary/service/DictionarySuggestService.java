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
import java.util.HashMap;
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

    /** 단일 그룹 greedy 분해 시 용어 논리명 최대 길이 */
    private static final int MAX_TERM_NAME_LENGTH = 20;

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

        // 2. 완전 일치 실패 토큰 → 팀 전체 용어 조회 (greedy 분해 + 부분 매칭용, 필요 시 1회 쿼리)
        final var unmatchedTokens = tokens
            .stream()
            .filter((t) -> !exactMatchMap.containsKey(t))
            .toList();
        final var allTerms = unmatchedTokens.isEmpty() ? List.<Term>of() : termRepository.findByTeamWithDomain(team);

        // 논리명 → Term 매핑 (greedy 분해용 O(1) 조회)
        final var termByNameMap = new HashMap<String, Term>();
        for (final var term : allTerms) {
            termByNameMap.put(term.getLogicalName(), term);
        }
        // 완전 일치 결과도 매핑에 포함 (greedy 분해에서 참조 가능)
        termByNameMap.putAll(exactMatchMap);

        // 토큰별 매칭 결과 조합
        final var matches = new ArrayList<SuggestMatch>();
        final var physicalParts = new ArrayList<String>();

        for (final var token : tokens) {
            // (1) 완전 일치
            final var exactTerm = exactMatchMap.get(token);
            if (exactTerm != null) {
                physicalParts.add(exactTerm.getPhysicalName());
                matches.add(new SuggestMatch(token, true, exactTerm.getPhysicalName(), "exact"));
                continue;
            }

            // (2) greedy longest-match 분해
            final var decomposed = decomposeGroup(token, termByNameMap);
            if (decomposed != null) {
                final var groupPhysical = decomposed.stream().map(Term::getPhysicalName).collect(Collectors.joining());
                physicalParts.add(groupPhysical);
                matches.add(new SuggestMatch(token, true, groupPhysical, "compound"));
                continue;
            }

            // (3) 인메모리 부분 일치 매칭
            final var partialTerm = allTerms
                .stream()
                .filter((t) -> t.getLogicalName().contains(token))
                .findFirst()
                .orElse(null);

            if (partialTerm != null) {
                physicalParts.add(partialTerm.getPhysicalName());
                matches.add(new SuggestMatch(token, true, partialTerm.getPhysicalName(), "partial"));
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

    /**
     * 공백 없는 연속 문자열을 greedy longest-match로 기본 용어로 분해한다.
     *
     * <p>FE의 {@code useDictionaryCache.decomposeGroup()}과 동일한 알고리즘이다.
     * 양쪽을 수정할 때 반드시 동기화해야 한다.</p>
     *
     * <p><b>알고리즘 계약 (FE/BE 동기 필수):</b></p>
     * <ol>
     *   <li>pos=0부터 greedy longest-match 탐색</li>
     *   <li>각 위치에서 len=min(남은길이, MAX_TERM_NAME_LENGTH)부터 1까지 내림차순 시도</li>
     *   <li>termByNameMap에서 substring 매칭 → 성공 시 pos += len, 다음 위치로</li>
     *   <li>어떤 위치에서도 매칭 실패 시 즉시 null 반환 (부분 결과 없음)</li>
     *   <li>최종 결과가 2개 미만이면 null 반환</li>
     *   <li>MAX_TERM_NAME_LENGTH = 20 (양쪽 동일)</li>
     * </ol>
     *
     * @param group         공백 없는 연속 문자열
     * @param termByNameMap 논리명 → Term 매핑
     * @return 분해된 Term 목록 (2개 이상) 또는 null (분해 실패)
     */
    private List<Term> decomposeGroup(String group, Map<String, Term> termByNameMap) {
        final var result = new ArrayList<Term>();
        var pos = 0;

        while (pos < group.length()) {
            var matched = false;
            final var maxLen = Math.min(group.length() - pos, MAX_TERM_NAME_LENGTH);

            for (var len = maxLen; len >= 1; len--) {
                final var substr = group.substring(pos, pos + len);
                final var term = termByNameMap.get(substr);
                if (term != null) {
                    result.add(term);
                    pos += len;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                return null;
            }
        }

        return result.size() >= 2 ? result : null;
    }
}
