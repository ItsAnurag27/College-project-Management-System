package com.taskmgr.auth.otp;

import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmailOtpRepository extends JpaRepository<EmailOtpEntity, UUID> {

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("""
      select o from EmailOtpEntity o
      where lower(o.email) = lower(:email)
        and o.purpose = :purpose
        and o.consumedAt is null
        and o.expiresAt > :now
      order by o.createdAt desc
      """)
  List<EmailOtpEntity> findLatestValidForUpdate(
      @Param("email") String email,
      @Param("purpose") OtpPurpose purpose,
      @Param("now") OffsetDateTime now,
      Pageable pageable
  );

  @Query("""
      select count(o) from EmailOtpEntity o
      where lower(o.email) = lower(:email)
        and o.purpose = :purpose
        and o.createdAt > :since
      """)
  long countRecentByEmailAndPurpose(
      @Param("email") String email,
      @Param("purpose") OtpPurpose purpose,
      @Param("since") OffsetDateTime since
  );

  @Query("""
      select count(o) from EmailOtpEntity o
      where lower(o.email) = lower(:email)
        and o.createdAt > :since
      """)
  long countRecentByEmail(
      @Param("email") String email,
      @Param("since") OffsetDateTime since
  );

  @Query("""
      select count(o) from EmailOtpEntity o
      where o.requestIp = :ip
        and o.createdAt > :since
      """)
  long countRecentByIp(
      @Param("ip") String ip,
      @Param("since") OffsetDateTime since
  );
}
