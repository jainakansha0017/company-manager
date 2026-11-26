require "rails_helper"

RSpec.describe SaudaBill do
  it "rejects a discount of more than the whole amount" do
    bill = build(:sauda_bill, discount_percent: 101)

    expect(bill).not_to be_valid
    expect(bill.errors[:discount_percent]).to be_present
  end
end
