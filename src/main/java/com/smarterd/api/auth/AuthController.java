package com.smarterd.api.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login() {
        // TODO: Implement login
        return ResponseEntity.ok(Map.of("message", "login endpoint stub"));
    }

    @PostMapping("/signup")
    public ResponseEntity<Map<String, String>> signup() {
        // TODO: Implement signup
        return ResponseEntity.ok(Map.of("message", "signup endpoint stub"));
    }
}
