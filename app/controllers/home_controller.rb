class HomeController < ApplicationController
  # The SPA shell is the login form as much as it is the app: React asks the
  # session endpoint who is signed in and renders one or the other. Guarding
  # this would leave a signed-out visitor with nothing to log in *with*.
  #
  # It serves only the empty shell — every piece of data behind it still comes
  # from the API, which is guarded.
  skip_before_action :require_login

  def index; end
end
