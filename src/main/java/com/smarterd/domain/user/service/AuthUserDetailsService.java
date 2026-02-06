package com.smarterd.domain.user.service;

import com.smarterd.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

/**
 * Spring Security {@link UserDetailsService} 구현체.
 *
 * <p>{@link UserRepository}를 통해 로그인 ID로 사용자를 조회하고,
 * Spring Security가 인증에 사용할 {@link UserDetails} 객체로 변환한다.
 * {@code DaoAuthenticationProvider}에서 비밀번호 비교 시 호출된다.</p>
 */
@Service
@RequiredArgsConstructor
public class AuthUserDetailsService implements UserDetailsService {

    /** 사용자 레포지토리 */
    private final UserRepository userRepository;

    /**
     * 로그인 ID로 사용자 정보를 조회하여 {@link UserDetails}를 반환한다.
     *
     * @param loginId 로그인 ID
     * @return Spring Security UserDetails (loginId, password, 빈 권한 목록)
     * @throws UsernameNotFoundException 해당 로그인 ID의 사용자가 존재하지 않는 경우
     */
    @Override
    public UserDetails loadUserByUsername(String loginId) throws UsernameNotFoundException {
        return userRepository.findByLoginId(loginId)
                .map(user -> new User(user.getLoginId(), user.getPassword(), Collections.emptyList()))
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + loginId));
    }
}
