package com.smarterd.domain.user.service;

/**
 * Signup command consumed by the authentication domain service.
 *
 * @param loginId login id
 * @param password raw password
 * @param name display name
 */
public record AuthSignupCommand(String loginId, String password, String name) {}
