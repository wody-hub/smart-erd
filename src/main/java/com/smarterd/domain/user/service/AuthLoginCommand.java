package com.smarterd.domain.user.service;

/**
 * Login command consumed by the authentication domain service.
 *
 * @param loginId login id
 * @param password raw password
 * @param clientIp client IP address
 */
public record AuthLoginCommand(String loginId, String password, String clientIp) {}
