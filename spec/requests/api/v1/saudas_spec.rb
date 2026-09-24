require "rails_helper"

RSpec.describe "Api::V1 saudas" do
  let(:json) { JSON.parse(response.body) }
  let(:company) { create(:company) }
  let(:seller) { create(:seller) }
  let(:buyer) { create(:buyer) }

  # The API is closed to anyone not signed in; sessions_spec covers that side.
  before { sign_in }

  describe "GET /api/v1/saudas" do
    it "returns this seller's saudas, newest date first" do
      older = create(:sauda, company: company, seller: seller, sauda_date: 3.days.ago.to_date)
      newer = create(:sauda, company: company, seller: seller, sauda_date: Date.current)

      get "/api/v1/saudas", params: { company_id: company.id, seller_id: seller.id }

      expect(response).to have_http_status(:ok)
      expect(json.map { |sauda| sauda["id"] }).to eq([newer.id, older.id])
    end

    it "does not leak saudas belonging to another seller" do
      other_seller = create(:seller)
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
        %w[id company_id seller_id buyer_id buyer_name sauda_no sauda_date bill_date
           tax_invoice_no destination transporter_name bilty_no bilty_date
           amount discount_percent total_tax_bill_amt gst_amt disc_amt taxable_value
           brokerage_amt total_kg created_at sauda_marks]
      )
    end

    it "nests each mark with its lot numbers and grades" do
      create(:sauda, company: company, seller: seller)

      get "/api/v1/saudas", params: { company_id: company.id, seller_id: seller.id }

      mark = json.first["sauda_marks"].first
      expect(mark.keys)
        .to match_array(%w[id mark_id mark_name lot_nos total_bags total_kg amount sauda_grades])
      expect(mark["sauda_grades"].first.keys)
        .to match_array(%w[id grade bags weight rate total_kg amount])
    end
  end

  # The same register, downloaded. What goes in the file is exercised in
  # spec/exports; this is about getting it out of the endpoint.
  describe "downloading the register" do
    before { create(:sauda, company: company, seller: seller, buyer: buyer) }

    it "hands back a spreadsheet" do
      get "/api/v1/saudas.xlsx", params: { company_id: company.id, seller_id: seller.id }

      expect(response).to have_http_status(:ok)
      expect(response.media_type)
        .to eq("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      expect(response.headers["Content-Disposition"])
        .to include("sauda-register-#{seller.name.parameterize}")
      expect(response.body).to start_with("PK")
    end

    it "hands back a PDF" do
      get "/api/v1/saudas.pdf", params: { company_id: company.id, seller_id: seller.id }

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("application/pdf")
      expect(response.body).to start_with("%PDF")
    end

    it "404s when the company or the seller is not on record" do
      get "/api/v1/saudas.pdf", params: { company_id: 0, seller_id: seller.id }

      expect(response).to have_http_status(:not_found)
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
          sauda_no: "S-2026-042",
          sauda_date: "2026-09-21",
          bill_date: "2026-09-23",
          tax_invoice_no: "TI-2026-118",
          destination: "Siliguri",
          transporter_name: "Sri Ganesh Roadways",
          bilty_no: "BL-9921",
          bilty_date: "2026-09-24",
          discount_percent: "2.5",
          sauda_marks_attributes: [
            {
              mark_id: mark.id,
              lot_nos: "L-1; L-2",
              # 255 kg @ 200 + 200 kg @ 245 = 100,000.
              sauda_grades_attributes: [
                { grade: "PD", bags: 10, weight: "25.5", rate: "200.00" },
                { grade: "BOP", bags: 4, weight: "50.0", rate: "245.00" }
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

    it "records how the goods travelled" do
      post "/api/v1/saudas", params: valid_params

      expect(json["transporter_name"]).to eq("Sri Ganesh Roadways")
      expect(json["bilty_no"]).to eq("BL-9921")
      expect(json["bilty_date"]).to eq("2026-09-24")
    end

    it "counts the bags on each mark" do
      post "/api/v1/saudas", params: valid_params

      expect(json["sauda_marks"].first["total_bags"]).to eq(14)
    end

    it "pays the broker one per cent of the figure the seller agreed on" do
      seller.update!(brokerage_basis: "taxable_value")

      post "/api/v1/saudas", params: valid_params

      expect(json["brokerage_amt"].to_f).to eq(975.0)
    end

    # bags x weight per bag, added up across every grade of every mark.
    it "works out the total kilos" do
      post "/api/v1/saudas", params: valid_params

      expect(json["total_kg"].to_f).to eq(455.0)
    end

    it "prices the grades and works the bill out from there" do
      post "/api/v1/saudas", params: valid_params

      expect(json["amount"].to_f).to eq(100_000.0)
      expect(json["sauda_marks"].first["amount"].to_f).to eq(100_000.0)
      expect(json["sauda_marks"].first["sauda_grades"].first["amount"].to_f).to eq(51_000.0)
      expect(json["disc_amt"].to_f).to eq(2_500.0)
      expect(json["taxable_value"].to_f).to eq(97_500.0)
      expect(json["gst_amt"].to_f).to eq(4_875.0)
      expect(json["total_tax_bill_amt"].to_f).to eq(102_375.0)
    end

    # The worked-out figures are not permitted parameters, so a caller cannot
    # post a bill that disagrees with the kilos and rates it claims to come from.
    it "ignores worked-out amounts sent by the caller" do
      params = valid_params.deep_merge(
        sauda: { amount: "1.00", disc_amt: "0.00", gst_amt: "1.00", taxable_value: "1.00",
                 total_tax_bill_amt: "1.00" }
      )

      post "/api/v1/saudas", params: params

      expect(json["amount"].to_f).to eq(100_000.0)
      expect(json["disc_amt"].to_f).to eq(2_500.0)
      expect(json["total_tax_bill_amt"].to_f).to eq(102_375.0)
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

  describe "GET /api/v1/saudas/:id" do
    it "returns the sauda with its marks and grades" do
      sauda = create(:sauda, company: company, seller: seller, buyer: buyer)

      get "/api/v1/saudas/#{sauda.id}"

      expect(response).to have_http_status(:ok)
      expect(json["id"]).to eq(sauda.id)
      expect(json["buyer_name"]).to eq(buyer.name)
      expect(json["sauda_marks"].first["sauda_grades"]).to be_present
    end

    it "404s for an unknown id" do
      get "/api/v1/saudas/0"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/saudas/:id" do
    let(:sauda) { create(:sauda, company: company, seller: seller, buyer: buyer) }
    let(:mark) { create(:mark, seller: seller) }

    it "updates the sauda's own fields" do
      patch "/api/v1/saudas/#{sauda.id}",
            params: { sauda: { destination: "Guwahati", tax_invoice_no: "TI-2026-900" } }

      expect(response).to have_http_status(:ok)
      expect(sauda.reload.destination).to eq("Guwahati")
      expect(sauda.tax_invoice_no).to eq("TI-2026-900")
    end

    # The form posts the marks whole, so what comes back is what was sent, not
    # the new rows added on top of the old ones.
    it "replaces the marks rather than adding to them" do
      patch "/api/v1/saudas/#{sauda.id}", params: {
        sauda: {
          sauda_marks_attributes: [
            {
              mark_id: mark.id,
              lot_nos: "L-9",
              sauda_grades_attributes: [{ grade: "BOP", bags: 2, weight: "50.0", rate: "300.00" }]
            }
          ]
        }
      }

      expect(response).to have_http_status(:ok)
      expect(json["sauda_marks"].length).to eq(1)
      expect(json["sauda_marks"].first["lot_nos"]).to eq("L-9")
      expect(sauda.reload.sauda_marks.count).to eq(1)
    end

    it "re-works the bill from the marks it was given" do
      patch "/api/v1/saudas/#{sauda.id}", params: {
        sauda: {
          discount_percent: "10.0",
          sauda_marks_attributes: [
            {
              mark_id: mark.id,
              # 100 kg @ 100 = 10,000.
              sauda_grades_attributes: [{ grade: "PD", bags: 4, weight: "25.0", rate: "100.00" }]
            }
          ]
        }
      }

      expect(json["total_kg"].to_f).to eq(100.0)
      expect(json["amount"].to_f).to eq(10_000.0)
      expect(json["disc_amt"].to_f).to eq(1_000.0)
      expect(json["taxable_value"].to_f).to eq(9_000.0)
      expect(json["gst_amt"].to_f).to eq(450.0)
      expect(json["total_tax_bill_amt"].to_f).to eq(9_450.0)
    end

    # The replacement is part of the save, so a rejected edit must not take the
    # marks that were already there down with it.
    it "keeps the marks it had when the edit is rejected" do
      before_marks = sauda.sauda_marks.pluck(:id)

      patch "/api/v1/saudas/#{sauda.id}", params: {
        sauda: {
          sauda_marks_attributes: [
            {
              mark_id: mark.id,
              sauda_grades_attributes: [{ grade: "PD", bags: 0, weight: "25.0" }]
            }
          ]
        }
      }

      expect(response).to have_http_status(:unprocessable_content)
      expect(sauda.reload.sauda_marks.pluck(:id)).to eq(before_marks)
    end

    it "404s for an unknown id" do
      patch "/api/v1/saudas/0", params: { sauda: { destination: "Nowhere" } }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/saudas/:id" do
    it "deletes the sauda with its marks and grades" do
      sauda = create(:sauda, company: company, seller: seller, mark_count: 2)

      expect { delete "/api/v1/saudas/#{sauda.id}" }
        .to change(Sauda, :count).by(-1)
        .and change(SaudaMark, :count).by(-2)
        .and change(SaudaGrade, :count).by(-2)

      expect(response).to have_http_status(:no_content)
    end

    it "leaves the seller, buyer and marks themselves alone" do
      sauda = create(:sauda, company: company, seller: seller, buyer: buyer)

      expect { delete "/api/v1/saudas/#{sauda.id}" }.not_to change(Party, :count)
      expect(Mark.where(seller: seller)).to be_present
    end

    it "404s for an unknown id" do
      delete "/api/v1/saudas/0"
      expect(response).to have_http_status(:not_found)
    end
  end
end
