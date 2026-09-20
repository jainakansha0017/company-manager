require "rails_helper"

RSpec.describe "Api::V1 saudas" do
  let(:json) { JSON.parse(response.body) }
  let(:company) { create(:company) }
  let(:seller) { create(:seller, company: company) }
  let(:buyer) { create(:buyer, company: company) }

  describe "GET /api/v1/saudas" do
    it "returns this seller's saudas, newest date first" do
      older = create(:sauda, company: company, seller: seller, sauda_date: 3.days.ago.to_date)
      newer = create(:sauda, company: company, seller: seller, sauda_date: Date.current)

      get "/api/v1/saudas", params: { company_id: company.id, seller_id: seller.id }

      expect(response).to have_http_status(:ok)
      expect(json.map { |sauda| sauda["id"] }).to eq([newer.id, older.id])
    end

    it "does not leak saudas belonging to another seller" do
      other_seller = create(:seller, company: company)
      create(:sauda, company: company, seller: other_seller)

      get "/api/v1/saudas", params: { company_id: company.id, seller_id: seller.id }

      expect(json).to be_empty
    end

    it "does not leak saudas belonging to another company" do
      create(:sauda)

      get "/api/v1/saudas", params: { company_id: company.id, seller_id: seller.id }

      expect(json).to be_empty
    end

    it "serialises the fields the register needs" do
      create(:sauda, company: company, seller: seller, buyer: buyer)

      get "/api/v1/saudas", params: { company_id: company.id, seller_id: seller.id }

      expect(json.first.keys).to match_array(
        %w[id company_id seller_id buyer_id buyer_name sauda_date tax_invoice_no destination
           total_tax_bill_amt gst_amt disc_amt taxable_value total_kg created_at sauda_marks]
      )
    end

    it "nests each mark with its lot numbers and grades" do
      create(:sauda, company: company, seller: seller)

      get "/api/v1/saudas", params: { company_id: company.id, seller_id: seller.id }

      mark = json.first["sauda_marks"].first
      expect(mark.keys).to match_array(%w[id mark_id mark_name lot_nos total_kg sauda_grades])
      expect(mark["sauda_grades"].first.keys).to match_array(%w[id grade bags weight total_kg])
    end
  end

  describe "POST /api/v1/saudas" do
    let(:mark) { create(:mark, seller: seller) }

    let(:valid_params) do
      {
        sauda: {
          company_id: company.id,
          seller_id: seller.id,
          buyer_id: buyer.id,
          sauda_date: "2026-09-21",
          tax_invoice_no: "TI-2026-118",
          destination: "Siliguri",
          total_tax_bill_amt: "125000.00",
          gst_amt: "6250.00",
          disc_amt: "500.00",
          taxable_value: "118250.00",
          sauda_marks_attributes: [
            {
              mark_id: mark.id,
              lot_nos: "L-1; L-2",
              sauda_grades_attributes: [
                { grade: "PD", bags: 10, weight: "25.5" },
                { grade: "BOP", bags: 4, weight: "50.0" }
              ]
            }
          ]
        }
      }
    end

    it "creates the sauda with its marks and grades" do
      expect { post "/api/v1/saudas", params: valid_params }
        .to change(Sauda, :count).by(1)
        .and change(SaudaMark, :count).by(1)
        .and change(SaudaGrade, :count).by(2)

      expect(response).to have_http_status(:created)
      expect(json["tax_invoice_no"]).to eq("TI-2026-118")
      expect(json["buyer_name"]).to eq(buyer.name)
    end

    # bags x weight per bag, added up across every grade of every mark.
    it "works out the total kilos" do
      post "/api/v1/saudas", params: valid_params

      expect(json["total_kg"].to_f).to eq(455.0)
    end

    it "rejects a sauda without a mark" do
      params = valid_params.deep_merge(sauda: { sauda_marks_attributes: [] })

      expect { post "/api/v1/saudas", params: params }.not_to change(Sauda, :count)

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]["sauda_marks"]).to include("must include at least one mark")
    end

    # index_nested_attribute_errors is on, so the form can point at the right row.
    it "reports nested errors with their position" do
      params = valid_params.deep_merge(
        sauda: { sauda_marks_attributes: [{ sauda_grades_attributes: [{ grade: "PD", bags: 0 }] }] }
      )

      post "/api/v1/saudas", params: params

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"].keys).to include("sauda_marks[0].sauda_grades[0].bags")
    end

    it "rejects a mark that belongs to another seller" do
      params = valid_params.deep_merge(
        sauda: { sauda_marks_attributes: [{ mark_id: create(:mark).id }] }
      )

      post "/api/v1/saudas", params: params

      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]["sauda_marks[0].mark"]).to include("does not belong to this seller")
    end
  end
end
