package com.smarterd.domain.project.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.team.entity.Team;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.lang.Nullable;

/**
 * 프로젝트 엔티티.
 *
 * <p>팀({@link Team}) 소속으로 하나 이상의 {@link com.smarterd.domain.diagram.entity.Diagram}을 포함한다.
 * ERD 설계의 최상위 그룹 단위이다.</p>
 */
@Entity
@Table(name = "projects")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Project extends BaseAuditEntity {

    /** 프로젝트 고유 식별자 (자동 증가) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 프로젝트 이름 (최대 100자) */
    @Column(nullable = false, length = 100)
    private String name;

    /** 프로젝트 설명 (최대 500자, nullable) */
    @Column(length = 500)
    private String description;

    /** 발주사 (최대 200자, nullable) */
    @Nullable
    @Column(name = "client_company", length = 200)
    private String clientCompany;

    /** 수주사 (최대 200자, nullable) */
    @Nullable
    @Column(name = "contractor_company", length = 200)
    private String contractorCompany;

    /** 계약 금액 (원 단위, nullable) */
    @Nullable
    @Column(name = "contract_amount")
    private Long contractAmount;

    /** 프로젝트 시작일 (DATE, nullable) */
    @Nullable
    @Column(name = "project_start_date")
    private LocalDate projectStartDate;

    /** 프로젝트 종료일 (DATE, nullable) */
    @Nullable
    @Column(name = "project_end_date")
    private LocalDate projectEndDate;

    /** 사업 범위 (서술형, nullable) */
    @Nullable
    @Column(name = "project_scope", columnDefinition = "TEXT")
    private String projectScope;

    /** 소속 팀 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    /**
     * 프로젝트 엔티티를 생성한다.
     *
     * @param name        프로젝트 이름
     * @param description 프로젝트 설명 (nullable)
     * @param team        소속 팀
     */
    @Builder
    public Project(String name, String description, Team team) {
        this.name = name;
        this.description = description;
        this.team = team;
    }

    /**
     * 프로젝트 정보를 변경한다.
     *
     * @param name        새 프로젝트 이름
     * @param description 새 프로젝트 설명 (nullable)
     */
    public void update(String name, String description) {
        this.name = name;
        this.description = description;
    }

    /**
     * 사업 개요 정보를 갱신한다.
     *
     * @param clientCompany     발주사
     * @param contractorCompany 수주사
     * @param contractAmount    계약 금액
     * @param startDate         프로젝트 시작일
     * @param endDate           프로젝트 종료일
     * @param projectScope      사업 범위
     */
    public void updateBusinessOverview(
        @Nullable String clientCompany,
        @Nullable String contractorCompany,
        @Nullable Long contractAmount,
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        @Nullable String projectScope
    ) {
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_INVALID_PROJECT_PERIOD.code());
        }

        this.clientCompany = clientCompany;
        this.contractorCompany = contractorCompany;
        this.contractAmount = contractAmount;
        this.projectStartDate = startDate;
        this.projectEndDate = endDate;
        this.projectScope = projectScope;
    }
}
