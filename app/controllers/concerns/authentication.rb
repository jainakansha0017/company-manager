# Signing in, signing out, and knowing who is asking.
#
# The session cookie holds the user's id and the session token that goes with
# it; everything else is looked up per request. Rails signs and encrypts that
# cookie, so neither can be forged client-side.
#
# The cookie also expires fifteen minutes after the last request (see
# config/initializers/session_store.rb), and the expiry is sealed inside it, so
# a browser that hangs on to it past that point is refused here too.
module Authentication
  extend ActiveSupport::Concern

  included do
    helper_method :current_user, :logged_in?
  end

  private

  def current_user
    return @current_user if defined?(@current_user)

    @current_user = user_from_session
  end

  # A cookie whose token no longer matches the user's belongs to a session that
  # has since been closed somewhere else, so it counts as signed out. The
  # comparison can be a plain one: the cookie is encrypted, so a token cannot be
  # guessed at a character at a time.
  def user_from_session
    user = session[:user_id] && User.find_by(id: session[:user_id])
    return if user.nil? || user.session_token != session[:session_token]

    user
  end

  def logged_in?
    current_user.present?
  end

  # Signing in ends whatever sessions the user already had: the new token makes
  # every cookie carrying the old one worthless.
  #
  # `reset_session` before writing the id, so a session cookie planted on the
  # browser before signing in cannot be used to ride along afterwards
  # (session fixation).
  def log_in(user)
    user.regenerate_session_token
    reset_session
    session[:user_id] = user.id
    session[:session_token] = user.session_token
    @current_user = user
  end

  # Rotating the token first shuts the user's other devices as well, not just
  # the browser that asked.
  def log_out
    current_user&.regenerate_session_token
    reset_session
    @current_user = nil
  end

  # The API answers in JSON, so an unauthenticated request gets a 401 rather
  # than a redirect to a login page the fetch could not follow anyway. The SPA
  # shell itself skips this — it has to load in order to show the login form.
  def require_login
    return if logged_in?

    render json: { errors: { base: ["You must be signed in."] } }, status: :unauthorized
  end
end
