# Signing in, signing out, and knowing who is asking.
#
# The session cookie holds nothing but the user's id; everything else is looked
# up per request. Rails signs and encrypts that cookie, so the id cannot be
# forged client-side.
module Authentication
  extend ActiveSupport::Concern

  included do
    helper_method :current_user, :logged_in?
  end

  private

  def current_user
    return @current_user if defined?(@current_user)

    @current_user = session[:user_id] && User.find_by(id: session[:user_id])
  end

  def logged_in?
    current_user.present?
  end

  # `reset_session` before writing the id, so a session cookie planted on the
  # browser before signing in cannot be used to ride along afterwards
  # (session fixation).
  def log_in(user)
    reset_session
    session[:user_id] = user.id
    @current_user = user
  end

  def log_out
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
