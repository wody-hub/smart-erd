package com.smarterd.domain.team.entity;

/**
 * 팀 내 구성원의 역할을 정의하는 열거형.
 *
 * <ul>
 *   <li>{@code ADMIN} — 팀 관리 권한 (설정 변경, 멤버 관리)</li>
 *   <li>{@code MEMBER} — 프로젝트·다이어그램 편집 권한</li>
 *   <li>{@code VIEWER} — 읽기 전용 접근 권한</li>
 * </ul>
 */
public enum TeamMemberRole {
    ADMIN,
    MEMBER,
    VIEWER,
}
