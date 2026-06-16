package com.smarterd.domain.user.service;

/**
 * Refresh-token command consumed by the authentication domain service.
 *
 * @param refreshToken refresh token value
 */
public record AuthRefreshTokenCommand(String refreshToken) {}
