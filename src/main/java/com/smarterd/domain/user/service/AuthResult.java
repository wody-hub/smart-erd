package com.smarterd.domain.user.service;

/**
 * Authentication result returned by the domain service.
 *
 * @param accessToken JWT access token
 * @param refreshToken refresh token
 * @param loginId login id
 * @param name display name
 */
public record AuthResult(String accessToken, String refreshToken, String loginId, String name) {}
