require "rails_helper"

RSpec.describe "Api::V1 marks" do
  let(:json) { JSON.parse(response.body) }
  let(:seller) { create(:seller) }

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

    it "serialises just what the dropdown needs" do
      create(:mark, seller: seller)

      get "/api/v1/marks", params: { seller_id: seller.id }

      expect(json.first.keys).to match_array(%w[id seller_id name])
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
end
