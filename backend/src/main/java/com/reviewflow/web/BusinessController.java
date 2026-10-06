package com.reviewflow.web;

import com.reviewflow.domain.Business;
import com.reviewflow.domain.QrCode;
import com.reviewflow.repo.BusinessRepository;
import com.reviewflow.repo.QrCodeRepository;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/business")
public class BusinessController {
  private final BusinessRepository businesses;
  private final QrCodeRepository codes;
  public BusinessController(BusinessRepository businesses, QrCodeRepository codes) { this.businesses = businesses; this.codes = codes; }

  record BusinessInput(@NotBlank String name, @NotBlank @Pattern(regexp = "https?://.+") String googleReviewUrl,
    @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude, @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude) {}
  record BusinessResponse(String id, String name, String slug, String googleReviewUrl, String trackingUrl, Double latitude, Double longitude) {}

  private UUID owner(Authentication authentication) { return (UUID) authentication.getPrincipal(); }
  private BusinessResponse dto(Business business) { QrCode qr = codes.findFirstByBusinessIdAndActiveTrue(business.id).orElse(null); return new BusinessResponse(business.id.toString(), business.name, business.slug, business.googleReviewUrl, qr == null ? null : "/r/" + qr.trackingSlug, business.latitude, business.longitude); }
  private void apply(Business business, BusinessInput input) {
    if ((input.latitude() == null) != (input.longitude() == null)) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "Provide both latitude and longitude.");
    business.name = input.name(); business.googleReviewUrl = input.googleReviewUrl(); business.latitude = input.latitude(); business.longitude = input.longitude(); business.updatedAt = Instant.now();
  }

  @GetMapping public BusinessResponse get(Authentication authentication) { return dto(businesses.findFirstByUserId(owner(authentication)).orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND, "Complete onboarding to create your business."))); }
  @PostMapping public ResponseEntity<BusinessResponse> create(@RequestBody @jakarta.validation.Valid BusinessInput input, Authentication authentication) { if (businesses.findFirstByUserId(owner(authentication)).isPresent()) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.CONFLICT, "This MVP supports one visible location."); Business business = new Business(); business.userId = owner(authentication); business.slug = slug(input.name()); apply(business, input); return ResponseEntity.status(HttpStatus.CREATED).body(dto(businesses.save(business))); }
  @PutMapping public BusinessResponse update(@RequestBody @jakarta.validation.Valid BusinessInput input, Authentication authentication) { Business business = businesses.findFirstByUserId(owner(authentication)).orElseThrow(); apply(business, input); return dto(businesses.save(business)); }
  @PostMapping("/qr") public Map<String, String> qr(Authentication authentication) { Business business = businesses.findFirstByUserId(owner(authentication)).orElseThrow(); QrCode qr = codes.findFirstByBusinessIdAndActiveTrue(business.id).orElseGet(() -> { QrCode created = new QrCode(); created.businessId = business.id; created.trackingSlug = business.slug; created.active = true; return codes.save(created); }); return Map.of("trackingUrl", "/r/" + qr.trackingSlug, "slug", qr.trackingSlug); }
  private String slug(String name) { String value = name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", ""); return value + "-" + UUID.randomUUID().toString().substring(0, 6); }
}
