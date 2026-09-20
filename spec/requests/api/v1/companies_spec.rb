require "rails_helper"

RSpec.describe "Api::V1::Companies", type: :request do
  let(:json) { response.parsed_body }

  describe "GET /api/v1/companies" do
    it "returns companies newest first with their bank accounts" do
      create(:company, name: "Older Co", created_at: 2.days.ago)
      create(:company, name: "Newer Co", bank_account_count: 2)

      get "/api/v1/companies"

      expect(response).to have_http_status(:ok)
      expect(json.map { |company| company["name"] }).to eq(["Newer Co", "Older Co"])
      expect(json.first["bank_accounts"].size).to eq(2)
    end

    it "returns an empty array when there are no companies" do
      get "/api/v1/companies"

      expect(response).to have_http_status(:ok)
      expect(json).to eq([])
    end
  end

  describe "POST /api/v1/companies" do
    let(:valid_params) do
      {
        company: {
          name: "Acme Foods",
          address: "12 Park Street, Kolkata 700016",
          email: "owner@acmefoods.test",
          phone_no: "+91 9830012345",
          pan: "ABCDE1234F",
          gst_registered: true,
          gst_no: "19ABCDE1234F1Z5",
          trade_license_no: "TL-2025-0091",
          food_license_no: "FSSAI-11223344556677",
          financial_year: "2025-26",
          bank_accounts_attributes: [
            { bank_name: "HDFC Bank", branch: "Park Street", account_number: "50100000001",
              ifsc_code: "HDFC0001234", account_type: "Current" },
            { bank_name: "ICICI Bank", branch: "Salt Lake", account_number: "60200000002",
              ifsc_code: "ICIC0004321", account_type: "Savings" }
          ]
        }
      }
    end

    it "creates the company with all of its bank accounts" do
      expect { post "/api/v1/companies", params: valid_params, as: :json }
        .to change(Company, :count).by(1)
        .and change(BankAccount, :count).by(2)

      expect(response).to have_http_status(:created)
      expect(json["name"]).to eq("Acme Foods")
      expect(json["gst_no"]).to eq("19ABCDE1234F1Z5")
      expect(json["bank_accounts"].map { |a| a["bank_name"] })
        .to contain_exactly("HDFC Bank", "ICICI Bank")
    end

    it "creates a company without GST when it is not registered" do
      params = valid_params.deep_merge(company: { gst_registered: false, gst_no: "" })

      post "/api/v1/companies", params: params, as: :json

      expect(response).to have_http_status(:created)
      expect(json["gst_registered"]).to be(false)
      expect(json["gst_no"]).to be_nil
    end

    it "rejects a GST-registered company with no GST number" do
      params = valid_params.deep_merge(company: { gst_registered: true, gst_no: "" })

      expect { post "/api/v1/companies", params: params, as: :json }
        .not_to change(Company, :count)

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]).to have_key("gst_no")
    end

    it "returns validation errors for missing required fields" do
      params = valid_params.deep_merge(company: { name: "", email: "nope" })

      post "/api/v1/companies", params: params, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]).to include("name", "email")
    end

    it "rejects a company with no bank accounts" do
      params = valid_params.deep_merge(company: { bank_accounts_attributes: [] })

      post "/api/v1/companies", params: params, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]).to have_key("bank_accounts")
    end

    it "surfaces nested bank account errors" do
      params = valid_params.deep_merge(
        company: { bank_accounts_attributes: [{ bank_name: "HDFC Bank", account_number: "abc" }] }
      )

      post "/api/v1/companies", params: params, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]).to have_key("bank_accounts[0].account_number")
    end

    it "indexes nested errors so each bank row can be blamed individually" do
      params = valid_params.deep_merge(
        company: { bank_accounts_attributes: [
          { bank_name: "HDFC Bank", account_number: "50100000001" },
          { bank_name: "ICICI Bank", account_number: "abc" }
        ] }
      )

      post "/api/v1/companies", params: params, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]).to have_key("bank_accounts[1].account_number")
      expect(json["errors"]).not_to have_key("bank_accounts[0].account_number")
    end
  end

  describe "PATCH /api/v1/companies/:id" do
    let(:company) { create(:company, name: "Old Name", bank_account_count: 2) }

    it "updates the company attributes" do
      patch "/api/v1/companies/#{company.id}",
            params: { company: { name: "New Name", financial_year: "2026-27" } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(json["name"]).to eq("New Name")
      expect(company.reload.financial_year).to eq("2026-27")
    end

    it "updates an existing bank account in place" do
      account = company.bank_accounts.first

      patch "/api/v1/companies/#{company.id}",
            params: { company: { bank_accounts_attributes: [
              { id: account.id, bank_name: "Kotak Mahindra Bank" }
            ] } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(account.reload.bank_name).to eq("Kotak Mahindra Bank")
      expect(company.reload.bank_accounts.count).to eq(2)
    end

    it "adds another bank account" do
      expect {
        patch "/api/v1/companies/#{company.id}",
              params: { company: { bank_accounts_attributes: [
                { bank_name: "Yes Bank", account_number: "70300000003" }
              ] } }, as: :json
      }.to change { company.bank_accounts.count }.by(1)

      expect(response).to have_http_status(:ok)
    end

    it "removes a bank account flagged with _destroy" do
      account = company.bank_accounts.first

      expect {
        patch "/api/v1/companies/#{company.id}",
              params: { company: { bank_accounts_attributes: [
                { id: account.id, _destroy: true }
              ] } }, as: :json
      }.to change { company.bank_accounts.count }.by(-1)

      expect(response).to have_http_status(:ok)
      expect(json["bank_accounts"].map { |a| a["id"] }).not_to include(account.id)
    end

    it "refuses to remove the last remaining bank account" do
      single = create(:company, bank_account_count: 1)
      account = single.bank_accounts.first

      expect {
        patch "/api/v1/companies/#{single.id}",
              params: { company: { bank_accounts_attributes: [
                { id: account.id, _destroy: true }
              ] } }, as: :json
      }.not_to change { single.bank_accounts.count }

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]).to have_key("bank_accounts")
    end

    it "returns validation errors without persisting changes" do
      patch "/api/v1/companies/#{company.id}",
            params: { company: { name: "", email: "bad" } }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]).to include("name", "email")
      expect(company.reload.name).to eq("Old Name")
    end

    it "clears the GST number when registration is turned off" do
      registered = create(:company, :gst_registered)

      patch "/api/v1/companies/#{registered.id}",
            params: { company: { gst_registered: false } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(registered.reload.gst_no).to be_nil
    end

    it "404s for an unknown company" do
      patch "/api/v1/companies/0", params: { company: { name: "Nope" } }, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/companies/:id" do
    it "deletes the company and its bank accounts" do
      company = create(:company, bank_account_count: 2)

      expect { delete "/api/v1/companies/#{company.id}", as: :json }
        .to change(Company, :count).by(-1)
        .and change(BankAccount, :count).by(-2)

      expect(response).to have_http_status(:no_content)
    end

    it "404s for an unknown company" do
      delete "/api/v1/companies/0", as: :json

      expect(response).to have_http_status(:not_found)
    end
  end
end
