require "rails_helper"

RSpec.describe Mark do
  it "is valid with a seller and a name" do
    expect(build(:mark)).to be_valid
  end

  it "requires a seller" do
    mark = build(:mark, seller: nil)

    expect(mark).not_to be_valid
    expect(mark.errors[:seller]).to be_present
  end

  it "requires a name" do
    mark = build(:mark, name: " ")

    expect(mark).not_to be_valid
    expect(mark.errors[:name]).to include("can't be blank")
  end

  it "tidies stray whitespace in the name" do
    mark = create(:mark, name: "  Golden   Tips  ")

    expect(mark.name).to eq("Golden Tips")
  end

  # Two sellers may well trade under the same mark name, so uniqueness is only
  # enforced within one seller.
  it "rejects a duplicate name for the same seller, ignoring case" do
    seller = create(:seller)
    create(:mark, seller: seller, name: "Golden Tips")

    duplicate = build(:mark, seller: seller, name: "golden tips")

    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:name]).to include("has already been taken")
  end

  it "allows the same name under a different seller" do
    create(:mark, name: "Golden Tips")

    expect(build(:mark, name: "Golden Tips")).to be_valid
  end

  it "goes away with its seller" do
    mark = create(:mark)

    expect { mark.seller.destroy }.to change(described_class, :count).by(-1)
  end

  it "refuses to be destroyed while a sauda uses it" do
    sauda_mark = create(:sauda_mark)
    mark = sauda_mark.mark

    expect(mark.destroy).to be false
    expect(mark.errors[:base]).to be_present
    expect(described_class.exists?(mark.id)).to be true
  end
end
