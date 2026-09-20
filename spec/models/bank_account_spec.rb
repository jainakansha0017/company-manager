require "rails_helper"

RSpec.describe BankAccount, type: :model do
  it "is valid with the baseline attributes" do
    expect(build(:bank_account)).to be_valid
  end

  it "requires a bank name" do
    expect(build(:bank_account, bank_name: nil)).not_to be_valid
  end

  it "requires a numeric account number of 6 to 20 digits" do
    expect(build(:bank_account, account_number: nil)).not_to be_valid
    expect(build(:bank_account, account_number: "12ab56")).not_to be_valid
    expect(build(:bank_account, account_number: "12345")).not_to be_valid
    expect(build(:bank_account, account_number: "123456")).to be_valid
  end

  it "rejects a duplicate account number under the same owner" do
    account = create(:bank_account)
    duplicate = build(:bank_account, accountable: account.accountable,
                                     account_number: account.account_number)

    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:account_number]).to include("is already added for this record")
  end

  it "allows the same account number under a different owner" do
    account = create(:bank_account)
    expect(build(:bank_account, account_number: account.account_number)).to be_valid
  end

  it "can belong to a buyer or a seller, not just a company" do
    buyer = create(:buyer)
    seller = create(:seller)

    expect(buyer.bank_accounts.first.accountable).to eq(buyer)
    expect(seller.bank_accounts.first.accountable).to eq(seller)
  end

  describe "IFSC code" do
    it "is optional and stored as nil when blank" do
      expect(create(:bank_account, ifsc_code: "").ifsc_code).to be_nil
    end

    it "is upcased" do
      expect(create(:bank_account, ifsc_code: "hdfc0001234").ifsc_code).to eq("HDFC0001234")
    end

    it "must match the IFSC format" do
      expect(build(:bank_account, ifsc_code: "HDFC1234")).not_to be_valid
    end
  end

  it "only allows known account types" do
    expect(build(:bank_account, account_type: "Chequing")).not_to be_valid
    expect(build(:bank_account, account_type: "Savings")).to be_valid
    expect(build(:bank_account, account_type: "")).to be_valid
  end
end
