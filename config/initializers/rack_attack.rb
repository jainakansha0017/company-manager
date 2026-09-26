# Slows down brute-forcing of the login form. No Redis on the free tier, so
# this falls back to Rails.cache (per-process memory) — good enough to blunt
# an automated attacker, even though counts are not shared across the two
# WEB_CONCURRENCY workers.
class Rack::Attack
  # Five attempts per IP per 20 seconds, so a real user mistyping a password
  # a couple of times is never caught by this.
  throttle("logins/ip", limit: 5, period: 20.seconds) do |req|
    req.ip if req.path == "/api/v1/session" && req.post?
  end

  # Five attempts per email per 20 seconds, so the same account cannot be
  # brute-forced from many IPs at once.
  throttle("logins/email", limit: 5, period: 20.seconds) do |req|
    if req.path == "/api/v1/session" && req.post?
      req.params["email"].to_s.downcase.presence
    end
  end
end

Rack::Attack.throttled_responder = lambda do |request|
  retry_after = (request.env["rack.attack.match_data"] || {})[:period]
  [429,
   { "Content-Type" => "application/json", "Retry-After" => retry_after.to_s },
   [{ errors: { base: ["Too many attempts. Please wait and try again."] } }.to_json]]
end
