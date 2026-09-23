require "rails_helper"

RSpec.describe "Api::V1::Sessions", type: :request do
  let(:password) { AuthenticationHelpers::DEFAULT_PASSWORD }
  let!(:user) { create(:user, email: "akansha@example.com", password: password) }

  def post_session(email:, password:)
    post "/api/v1/session",
         params: { email: email, password: password }.to_json,
         headers: { "CONTENT_TYPE" => "application/json" }
  end

  describe "POST /api/v1/session" do
    it "signs the user in and returns who they are" do
      post_session(email: "akansha@example.com", password: password)

      expect(response).to have_http_status(:created)
      body = response.parsed_body
      expect(body["id"]).to eq(user.id)
      expect(body["name"]).to eq(user.name)
      expect(body["email"]).to eq("akansha@example.com")
    end

    it "never sends the password digest back" do
      post_session(email: "akansha@example.com", password: password)

      expect(response.parsed_body).not_to have_key("password_digest")
    end

    # reset_session rotates the CSRF token, so the page's old one is dead. The
    # client needs the new one to keep making requests.
    it "returns a fresh CSRF token" do
      post_session(email: "akansha@example.com", password: password)

      expect(response.parsed_body["csrf_token"]).to be_present
    end

    it "ignores how the email was typed" do
      post_session(email: " AKANSHA@Example.com ", password: password)

      expect(response).to have_http_status(:created)
    end

    it "refuses a wrong password" do
      post_session(email: "akansha@example.com", password: "wrong password here")

      expect(response).to have_http_status(:unauthorized)
    end

    it "refuses an unknown email" do
      post_session(email: "nobody@example.com", password: password)

      expect(response).to have_http_status(:unauthorized)
    end

    # The same message either way, so the form cannot be used to discover which
    # addresses have accounts.
    it "says the same thing for a wrong password as for an unknown email" do
      post_session(email: "akansha@example.com", password: "wrong password here")
      wrong_password = response.parsed_body

      post_session(email: "nobody@example.com", password: password)

      expect(response.parsed_body).to eq(wrong_password)
    end

    it "leaves the session closed when it refuses" do
      post_session(email: "akansha@example.com", password: "wrong password here")

      get "/api/v1/session"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/session" do
    it "returns the signed-in user" do
      sign_in(user)

      get "/api/v1/session"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["email"]).to eq("akansha@example.com")
    end

    it "is unauthorized when nobody is signed in" do
      get "/api/v1/session"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "DELETE /api/v1/session" do
    it "signs the user out" do
      sign_in(user)

      delete "/api/v1/session"
      expect(response).to have_http_status(:ok)

      get "/api/v1/session"
      expect(response).to have_http_status(:unauthorized)
    end

    it "shuts the API again" do
      sign_in(user)
      sign_out

      get "/api/v1/companies"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "guarding the API" do
    # Every endpoint hangs off ApplicationController, which requires a login, so
    # this stands for all of them.
    it "refuses a signed-out request" do
      get "/api/v1/companies"

      expect(response).to have_http_status(:unauthorized)
    end

    it "lets a signed-in request through" do
      sign_in(user)

      get "/api/v1/companies"

      expect(response).to have_http_status(:ok)
    end

    # The shell has to load signed out, or there would be nothing to log in with.
    it "still serves the React shell signed out" do
      get root_path

      expect(response).to have_http_status(:ok)
      expect(response.body).to include('<div id="root">')
    end
  end
end
