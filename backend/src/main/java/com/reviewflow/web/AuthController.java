package com.reviewflow.web;

import com.reviewflow.domain.Business;
import com.reviewflow.domain.User;
import com.reviewflow.repo.BusinessRepository;
import com.reviewflow.repo.UserRepository;
import com.reviewflow.security.JwtService;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/auth")
public class AuthController {
 private final UserRepository users; private final BusinessRepository businesses; private final PasswordEncoder passwords; private final JwtService jwt;
 public AuthController(UserRepository users, BusinessRepository businesses, PasswordEncoder passwords, JwtService jwt){this.users=users;this.businesses=businesses;this.passwords=passwords;this.jwt=jwt;}
 record Register(@NotBlank String ownerName,@NotBlank String businessName,@Email String email,@Size(min=8) String password){}
 record Login(@Email String email,@NotBlank String password){}
 record AuthResponse(String token,String ownerName,String businessName,boolean onboardingRequired){}
 record ChangePassword(@NotBlank String currentPassword,@Size(min=8) String newPassword){}

 @PostMapping("/register") public ResponseEntity<AuthResponse> register(@RequestBody @jakarta.validation.Valid Register input){
  if(users.findByEmailIgnoreCase(input.email()).isPresent())throw new org.springframework.web.server.ResponseStatusException(HttpStatus.CONFLICT,"An account with that email already exists.");
  User user=new User();user.name=input.ownerName();user.email=input.email().toLowerCase();user.passwordHash=passwords.encode(input.password());users.save(user);
  return ResponseEntity.status(HttpStatus.CREATED).body(new AuthResponse(jwt.issue(user.id),user.name,input.businessName(),true));
 }
 @PostMapping("/login") public AuthResponse login(@RequestBody @jakarta.validation.Valid Login input){
  User user=users.findByEmailIgnoreCase(input.email()).filter(value->passwords.matches(input.password(),value.passwordHash)).orElseThrow(()->new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid email or password."));
  Business business=businesses.findFirstByUserId(user.id).orElse(null);
  return new AuthResponse(jwt.issue(user.id),user.name,business==null?"":business.name,business==null);
 }
 @PostMapping("/change-password") public ResponseEntity<Void> changePassword(@RequestBody @jakarta.validation.Valid ChangePassword input,org.springframework.security.core.Authentication auth){User user=users.findById((UUID)auth.getPrincipal()).orElseThrow(()->new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED));if(!passwords.matches(input.currentPassword(),user.passwordHash))throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST,"Current password is incorrect.");user.passwordHash=passwords.encode(input.newPassword());users.save(user);return ResponseEntity.noContent().build();}
 @PostMapping("/forgot-password") public ResponseEntity<Void> forgot(@RequestBody Map<String,String> body){return ResponseEntity.accepted().build();}
}
