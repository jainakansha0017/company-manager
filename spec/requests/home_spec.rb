require "rails_helper"

RSpec.describe "Home", type: :request do
  it "renders the mount point that React boots into" do
    get root_path

    expect(response).to have_http_status(:ok)
    expect(response.body).to include('<div id="root">')
  end

  # These are React routes; Rails must serve the SPA so a refresh or a pasted
  # link does not 404.
  %w[
    /buyers
    /buyers/new
    /sellers
    /sellers/new
    /companies
    /companies/1
    /companies/1/sauda-register
    /companies/1/sauda-register/new
    /companies/1/inventory
    /companies/1/accounts
  ].each do |path|
    it "serves the React app at #{path}" do
      get path

      expect(response).to have_http_status(:ok)
      expect(response.body).to include('<div id="root">')
    end
  end

  it "still routes the API rather than the SPA" do
    sign_in

    get "/api/v1/companies"

    expect(response).to have_http_status(:ok)
    expect(response.body).not_to include('<div id="root">')
  end

  # The catch-all must not swallow /api either when signed out: the answer
  # should be a JSON 401, not the SPA shell with a 200.
  it "refuses the API rather than serving the SPA when signed out" do
    get "/api/v1/companies"

    expect(response).to have_http_status(:unauthorized)
    expect(response.body).not_to include('<div id="root">')
  end
end
