require "rails_helper"

RSpec.describe Party do
  it "stores buyers and sellers in one table, split by type" do
    buyer = create(:buyer)
    seller = create(:seller)

    expect(buyer.type).to eq("Buyer")
    expect(seller.type).to eq("Seller")
    expect(Party.count).to eq(2)
    expect(Buyer.all).to eq([buyer])
    expect(Seller.all).to eq([seller])
  end

  it "requires a company" do
    expect(build(:buyer, company: nil)).not_to be_valid
  end

  it "requires at least one bank account" do
    expect(build(:buyer, bank_account_count: 0)).not_to be_valid
  end

  it "has no financial year of its own" do
    expect(Party.column_names).not_to include("financial_year")
  end

  it "does not require an email or a phone number either" do
    expect(build(:buyer, email: nil, phone_no: nil)).to be_valid
    expect(build(:seller, email: "", phone_no: "")).to be_valid
  end

  it "normalises PAN and email the same way a company does" do
    buyer = create(:buyer, pan: "  zxcvb1234n ", email: "  Contact@Partner.TEST ")

    expect(buyer.pan).to eq("ZXCVB1234N")
    expect(buyer.email).to eq("contact@partner.test")
  end

  it "clears the GST number when not registered" do
    buyer = create(:buyer, gst_registered: false, gst_no: "19PQRST1111Z1Z5")
    expect(buyer.gst_no).to be_nil
  end

  it "destroys its bank accounts when destroyed" do
    buyer = create(:buyer, bank_account_count: 2)
    expect { buyer.destroy }.to change(BankAccount, :count).by(-2)
  end

  describe "PAN uniqueness" do
    it "rejects the same PAN twice for one company in the same role" do
      buyer = create(:buyer, pan: "AAAAA1111A")
      duplicate = build(:buyer, company: buyer.company, pan: "AAAAA1111A")

      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:pan]).to include("has already been taken")
    end

    it "allows the same PAN for a different company" do
      buyer = create(:buyer, pan: "BBBBB2222B")
      expect(build(:buyer, pan: "BBBBB2222B")).to be_valid
      expect(buyer.reload).to be_persisted
    end

    it "allows one entity to be both a buyer and a seller for the same company" do
      buyer = create(:buyer, pan: "CCCCC3333C")
      seller = build(:seller, company: buyer.company, pan: "CCCCC3333C")

      expect(seller).to be_valid
    end
  end

  describe "a seller's brokerage basis" do
    it "accepts either of the sauda figures the broker can be paid on" do
      expect(build(:seller, brokerage_basis: "amount")).to be_valid
      expect(build(:seller, brokerage_basis: "taxable_value")).to be_valid
    end

    it "rejects any other figure" do
      seller = build(:seller, brokerage_basis: "gst_amt")

      expect(seller).not_to be_valid
      expect(seller.errors[:brokerage_basis]).to be_present
    end

    it "reads an unset dropdown as no brokerage at all" do
      expect(create(:seller, brokerage_basis: "").brokerage_basis).to be_nil
    end
  end
end
