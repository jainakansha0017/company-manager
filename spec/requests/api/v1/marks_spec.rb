require "rails_helper"

RSpec.describe "Api::V1 marks" do
  let(:json) { JSON.parse(response.body) }
  let(:seller) { create(:seller) }

  # The API is closed to anyone not signed in; sessions_spec covers that side.
  before { sign_in }

  describe "GET /api/v1/marks" do
    it "returns this seller's marks in name order" do
      create(:mark, seller: seller, name: "Zenith")
      create(:mark, seller: seller, name: "Apex")

      get "/api/v1/marks", params: { seller_id: seller.id }

      expect(response).to have_http_status(:ok)
      expect(json.map { |mark| mark["name"] }).to eq(%w[Apex Zenith])
    end

    it "does not leak another seller's marks" do
      create(:mark)

      get "/api/v1/marks", params: { seller_id: seller.id }

      expect(json).to be_empty
    end

    it "serialises what the dropdown needs, including the seller's name" do
      create(:mark, seller: seller)

      get "/api/v1/marks", params: { seller_id: seller.id }

      expect(json.first.keys).to match_array(%w[id seller_id name seller_name])
      expect(json.first["seller_name"]).to eq(seller.name)
    end

    it "returns every seller's marks when no seller_id is given" do
      create(:mark, seller: seller, name: "Zenith")
      create(:mark, name: "Apex")

      get "/api/v1/marks"

      expect(response).to have_http_status(:ok)
      expect(json.map { |mark| mark["name"] }).to eq(%w[Apex Zenith])
    end
  end

  describe "POST /api/v1/marks" do
    it "creates a mark against the seller" do
      expect { post "/api/v1/marks", params: { mark: { seller_id: seller.id, name: "Golden Tips" } } }
        .to change(Mark, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(json["name"]).to eq("Golden Tips")
      expect(json["seller_id"]).to eq(seller.id)
    end

    it "rejects a blank name" do
      post "/api/v1/marks", params: { mark: { seller_id: seller.id, name: " " } }

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]["name"]).to include("can't be blank")
    end

    it "rejects a name the seller already uses" do
      create(:mark, seller: seller, name: "Golden Tips")

      post "/api/v1/marks", params: { mark: { seller_id: seller.id, name: "golden tips" } }

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]["name"]).to include("has already been taken")
    end
  end

  describe "DELETE /api/v1/marks/:id" do
    it "deletes a mark that is not used on any sauda" do
      mark = create(:mark, seller: seller)

      expect { delete "/api/v1/marks/#{mark.id}" }.to change(Mark, :count).by(-1)

      expect(response).to have_http_status(:no_content)
    end

    it "refuses to delete a mark that a sauda uses" do
      sauda_mark = create(:sauda_mark)

      expect { delete "/api/v1/marks/#{sauda_mark.mark.id}" }.not_to change(Mark, :count)

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]["base"]).to be_present
    end

    it "404s for a mark that does not exist" do
      delete "/api/v1/marks/0"

      expect(response).to have_http_status(:not_found)
    end
  end
end
