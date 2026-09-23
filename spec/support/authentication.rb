# Every API endpoint is behind the login, so a request spec has to sign in
# before it can ask for anything.
module AuthenticationHelpers
  # Matches the `:user` factory, so `sign_in` with no arguments just works.
  DEFAULT_PASSWORD = "correct horse battery".freeze

  # Goes through the real endpoint rather than writing to the session directly,
  # so the specs exercise the same path a browser takes.
  def sign_in(user = create(:user), password: DEFAULT_PASSWORD)
    post "/api/v1/session",
         params: { email: user.email, password: password }.to_json,
         headers: { "CONTENT_TYPE" => "application/json" }
    user
  end

  def sign_out
    delete "/api/v1/session"
  end
end

RSpec.configure do |config|
  config.include AuthenticationHelpers, type: :request
end
