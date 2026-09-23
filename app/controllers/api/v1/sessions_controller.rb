module Api
  module V1
    # Signing in and out. The session itself lives in the cookie Rails already
    # signs; this controller only opens and closes it.
    class SessionsController < ApplicationController
      protect_from_forgery with: :exception

      # Asking who you are, and signing in, both have to work while signed out.
      skip_before_action :require_login, only: %i[show create]

      # Who am I? The SPA calls this on boot to decide between the app and the
      # login form. A 401 here is an ordinary answer, not an error.
      def show
        if logged_in?
          render json: serialize(current_user)
        else
          render json: { errors: { base: ["Not signed in."] } }, status: :unauthorized
        end
      end

      def create
        user = User.authenticate(email: params[:email], password: params[:password])

        if user
          log_in(user)
          render json: serialize(user), status: :created
        else
          # Deliberately the same message whether the address is unknown or the
          # password is wrong, so the form cannot be used to find out which
          # addresses have accounts.
          render json: { errors: { base: ["Email or password is incorrect."] } },
                 status: :unauthorized
        end
      end

      def destroy
        log_out
        render json: { csrf_token: form_authenticity_token }
      end

      private

      # `reset_session` rotates the CSRF token, so the token the page was served
      # with is dead the moment you sign in or out. Handing the new one back
      # lets the SPA keep going without a reload.
      def serialize(user)
        user.as_json(only: %i[id name email]).merge("csrf_token" => form_authenticity_token)
      end
    end
  end
end
