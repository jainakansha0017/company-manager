require "rails_helper"

RSpec.describe Company, type: :model do
  it "is valid with the baseline attributes" do
    expect(build(:company)).to be_valid
  end

  %i[name address email phone_no financial_year].each do |attribute|
    it "requires #{attribute}" do
      company = build(:company, attribute => nil)
      expect(company).not_to be_valid
      expect(company.errors[attribute]).to be_present
    end
  end

  it "rejects a malformed email" do
    expect(build(:company, email: "not-an-email")).not_to be_valid
  end

  it "rejects a financial year that is not in YYYY-YY form" do
    expect(build(:company, financial_year: "last year")).not_to be_valid
    expect(build(:company, financial_year: "2025-26")).to be_valid
    expect(build(:company, financial_year: "2025-2026")).to be_valid
  end

  describe "PAN" do
    it "is optional" do
      expect(build(:company, pan: "")).to be_valid
    end

    it "stores a blank PAN as nil so blanks do not collide" do
      company = create(:company, pan: "")
      expect(company.pan).to be_nil
    end

    it "must match the Indian PAN format" do
      expect(build(:company, pan: "ABC123")).not_to be_valid
    end

    it "is upcased before validation" do
      expect(create(:company, pan: "abcde9999f").pan).to eq("ABCDE9999F")
    end

    it "must be unique" do
      create(:company, pan: "ABCDE1111F")
      expect(build(:company, pan: "ABCDE1111F")).not_to be_valid
    end
  end

  describe "GST" do
    it "requires a GST number when registered" do
      company = build(:company, gst_registered: true, gst_no: nil)
      expect(company).not_to be_valid
      expect(company.errors[:gst_no]).to be_present
    end

    it "validates the GST number format when registered" do
      expect(build(:company, gst_registered: true, gst_no: "12345")).not_to be_valid
      expect(build(:company, :gst_registered)).to be_valid
    end

    it "discards any GST number when not registered" do
      company = create(:company, gst_registered: false, gst_no: "19ABCDE1234F1Z5")
      expect(company.gst_no).to be_nil
    end

    it "must be unique among registered companies" do
      create(:company, gst_registered: true, gst_no: "19ABCDE1234F1Z5")
      expect(build(:company, gst_registered: true, gst_no: "19ABCDE1234F1Z5")).not_to be_valid
    end
  end

  describe "bank accounts" do
    it "requires at least one" do
      company = build(:company, bank_account_count: 0)
      expect(company).not_to be_valid
      expect(company.errors[:bank_accounts]).to include("must include at least one account")
    end

    it "accepts more than one" do
      company = create(:company, bank_account_count: 3)
      expect(company.bank_accounts.count).to eq(3)
    end

    it "builds them from nested attributes" do
      company = Company.new(
        attributes_for(:company).merge(
          bank_accounts_attributes: [
            { bank_name: "HDFC Bank", account_number: "50100000001", ifsc_code: "HDFC0001234" },
            { bank_name: "ICICI Bank", account_number: "60200000002", ifsc_code: "ICIC0004321" }
          ]
        )
      )

      expect(company.save).to be(true)
      expect(company.bank_accounts.pluck(:bank_name)).to contain_exactly("HDFC Bank", "ICICI Bank")
    end

    it "destroys them along with the company" do
      company = create(:company, bank_account_count: 2)
      expect { company.destroy }.to change(BankAccount, :count).by(-2)
    end

    it "refuses an update that marks every account for destruction" do
      company = create(:company, bank_account_count: 2)

      company.assign_attributes(
        bank_accounts_attributes: company.bank_accounts.map { |a| { id: a.id, _destroy: true } }
      )

      expect(company).not_to be_valid
      expect(company.errors[:bank_accounts]).to include("must include at least one account")
    end
  end
end
