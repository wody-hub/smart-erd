package com.smarterd.domain.ai;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;

/**
 * Repository for server-owned AI action proposals.
 */
public interface AiActionProposalRepository extends JpaRepository<AiActionProposal, Long> {
    Optional<AiActionProposal> findByProposalId(String proposalId);

    List<AiActionProposal> findByStatusAndExpiresAtBefore(AiActionProposalStatus status, Instant now);

    List<AiActionProposal> findByTeamIdAndProjectIdOrderByCreatedAtDescIdDesc(Long teamId, Long projectId);

    List<AiActionProposal> findByTeamIdAndProjectId(Long teamId, Long projectId, Pageable pageable);

    List<AiActionProposal> findByExecutionIdOrderByIdAsc(String executionId);
}
