require "rails_helper"

# Buyers and sellers go through the same controller, so the whole suite runs
# against both roles.
RSpec.describe "Api::V1 buyers and sellers" do
  let(:json) { JSON.parse(response.body) }

  # The API is closed to anyone not signed in; sessions_spec covers that side.
  before { sign_in }

  %w[buyer seller].each do |role|
    describe "/api/v1/#{role}s" do
      # Eager so the company's own bank account is not counted inside `expect {}`.
      let!(:company) { create(:company) }
      let(:factory) { role.to_sym }
      let(:model) { role.camelize.constantize }
      let(:path) { "/api/v1/#{role}s" }

      let(:valid_params) do
        {
          role => {
            company_id: company.id,
            name: "Sundar Enterprises",
            address: "22 Rash Behari Avenue, Kolkata 700019",
            email: "books@sundar.test",
            phone_no: "+91 9831567890",
            pan: "SUNDR1234E",
            gst_registered: false,
            trade_license_no: "TL-2025-7788",
            food_license_no: "FSSAI-12312312312312",
            bank_accounts_attributes: [
              { bank_name: "Axis Bank", branch: "Gariahat", account_number: "91800012345",
                ifsc_code: "UTIB0000123", account_type: "Current" }
            ]
          }
        }
      end

      describe "GET index" do
        it "returns only this company's records for this role" do
          mine = create(factory, company: company, name: "Mine")
          create(factory, name: "Someone else's")
          create(role == "buyer" ? :seller : :buyer, company: company, name: "Other role")

          get path, params: { company_id: company.id }

          expect(response).to have_http_status(:ok)
          expect(json.map { |p| p["name"] }).to eq(["Mine"])
          expect(json.first["id"]).to eq(mine.id)
        end

        it "returns an empty list for a company with none" do
          get path, params: { company_id: create(:company).id }

          expect(response).to have_http_status(:ok)
          expect(json).to eq([])
        end

        it "sorts by name" do
          create(factory, company: company, name: "Zebra Traders")
          create(factory, company: company, name: "Ajanta Supplies")

          get path, params: { company_id: company.id }

          expect(json.map { |p| p["name"] }).to eq(["Ajanta Supplies", "Zebra Traders"])
        end
      end

      describe "POST create" do
        it "creates the record with its bank account" do
          expect { post path, params: valid_params, as: :json }
            .to change(model, :count).by(1)
            .and change(BankAccount, :count).by(1)

          expect(response).to have_http_status(:created)
          expect(json["name"]).to eq("Sundar Enterprises")
          expect(json["company_id"]).to eq(company.id)
          expect(json["bank_accounts"].first["ifsc_code"]).to eq("UTIB0000123")
        end

        it "stores it under the right STI type" do
          post path, params: valid_params, as: :json

          expect(model.find(json["id"])).to be_present
          expect(Party.find(json["id"]).type).to eq(role.camelize)
        end

        it "accepts several bank accounts" do
          params = valid_params.deep_merge(
            role => { bank_accounts_attributes: [
              { bank_name: "Axis Bank", account_number: "91800012345" },
              { bank_name: "IDFC First", account_number: "10200034567" }
            ] }
          )

          expect { post path, params: params, as: :json }.to change(BankAccount, :count).by(2)
          expect(json["bank_accounts"].length).to eq(2)
        end

        it "requires a GST number when registered" do
          params = valid_params.deep_merge(role => { gst_registered: true })

          post path, params: params, as: :json

          expect(response).to have_http_status(:unprocessable_content)
          expect(json["errors"]).to have_key("gst_no")
        end

        it "rejects a record with no bank account" do
          params = valid_params.deep_merge(role => { bank_accounts_attributes: [] })

          post path, params: params, as: :json

          expect(response).to have_http_status(:unprocessable_content)
          expect(json["errors"]).to have_key("bank_accounts")
        end

        it "requires a company" do
          params = valid_params.deep_merge(role => { company_id: nil })

          post path, params: params, as: :json

          expect(response).to have_http_status(:unprocessable_content)
          expect(json["errors"]).to have_key("company")
        end
      end

      describe "PATCH update" do
        it "updates attributes and nested banks in one call" do
          record = create(factory, company: company, name: "Before", bank_account_count: 2)
          kept, removed = record.bank_accounts.to_a

          patch "#{path}/#{record.id}", params: {
            role => {
              name: "After",
              bank_accounts_attributes: [
                { id: kept.id, bank_name: "Renamed Bank" },
                { id: removed.id, _destroy: true },
                { bank_name: "Brand New Bank", account_number: "55500011122" }
              ]
            }
          }, as: :json

          expect(response).to have_http_status(:ok)
          expect(record.reload.name).to eq("After")
          expect(record.bank_accounts.pluck(:bank_name))
            .to contain_exactly("Renamed Bank", "Brand New Bank")
        end

        it "refuses to remove the last bank account" do
          record = create(factory, company: company, bank_account_count: 1)
          account = record.bank_accounts.first

          patch "#{path}/#{record.id}", params: {
            role => { bank_accounts_attributes: [{ id: account.id, _destroy: true }] }
          }, as: :json

          expect(response).to have_http_status(:unprocessable_content)
          expect(record.reload.bank_accounts.count).to eq(1)
        end

        it "404s for an id belonging to the other role" do
          other = create(role == "buyer" ? :seller : :buyer, company: company)

          patch "#{path}/#{other.id}", params: { role => { name: "Nope" } }, as: :json

          expect(response).to have_http_status(:not_found)
          expect(other.reload.name).not_to eq("Nope")
        end
      end

      describe "DELETE destroy" do
        it "deletes the record and its bank accounts" do
          record = create(factory, company: company, bank_account_count: 2)

          expect { delete "#{path}/#{record.id}", as: :json }
            .to change(model, :count).by(-1)
            .and change(BankAccount, :count).by(-2)

          expect(response).to have_http_status(:no_content)
        end

        it "404s for an unknown id" do
          delete "#{path}/0", as: :json
          expect(response).to have_http_status(:not_found)
        end
      end
    end
  end

  # Brokerage belongs to the seller side of the shared controller.
  describe "a seller's brokerage basis" do
    let(:company) { create(:company) }

    it "is stored and returned" do
      seller = create(:seller, company: company)

      patch "/api/v1/sellers/#{seller.id}",
            params: { seller: { brokerage_basis: "taxable_value" } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(json["brokerage_basis"]).to eq("taxable_value")
      expect(seller.reload.brokerage_basis).to eq("taxable_value")
    end

    # The form posts the whole record back, banks and all, not just the dropdown.
    it "is stored when the whole form is sent back" do
      seller = create(:seller, company: company)
      account = seller.bank_accounts.first

      patch "/api/v1/sellers/#{seller.id}", params: {
        seller: {
          name: seller.name, address: seller.address, email: seller.email,
          phone_no: seller.phone_no, pan: seller.pan, gst_registered: false, gst_no: "",
          trade_license_no: "", food_license_no: "", brokerage_basis: "amount",
          bank_accounts_attributes: [{ id: account.id, bank_name: account.bank_name }],
          company_id: company.id
        }
      }, as: :json

      expect(response).to have_http_status(:ok)
      expect(seller.reload.brokerage_basis).to eq("amount")
    end

    it "rejects a figure the sauda does not have" do
      seller = create(:seller, company: company)

      patch "/api/v1/sellers/#{seller.id}",
            params: { seller: { brokerage_basis: "gst_amt" } }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]).to have_key("brokerage_basis")
    end

    it "is not offered to buyers" do
      buyer = create(:buyer, company: company)

      get "/api/v1/buyers", params: { company_id: company.id }

      expect(json.first["id"]).to eq(buyer.id)
      expect(json.first).not_to have_key("brokerage_basis")
    end
  end

  it "removes a company's buyers and sellers along with it" do
    company = create(:company)
    create(:buyer, company: company)
    create(:seller, company: company)

    expect { delete "/api/v1/companies/#{company.id}", as: :json }
      .to change(Party, :count).by(-2)
  end
end
