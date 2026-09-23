class ApplicationController < ActionController::Base
  include Authentication

  # Closed by default: a new controller is behind the login unless it says
  # otherwise, so forgetting to guard one cannot quietly expose it.
  before_action :require_login
end
