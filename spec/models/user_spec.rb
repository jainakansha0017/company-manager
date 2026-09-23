require "rails_helper"

RSpec.describe User do
  it "is valid with a name, email and password" do
    expect(build(:user)).to be_valid
  end

  it "requires a name" do
    user = build(:user, name: " ")

    expect(user).not_to be_valid
    expect(user.errors[:name]).to include("can't be blank")
  end

  it "requires an email" do
    user = build(:user, email: "")

    expect(user).not_to be_valid
    expect(user.errors[:email]).to include("can't be blank")
  end

  it "rejects an email that is not an address" do
    user = build(:user, email: "not-an-address")

    expect(user).not_to be_valid
    expect(user.errors[:email]).to include("is not a valid email address")
  end

  it "requires a password" do
    user = build(:user, password: nil)

    expect(user).not_to be_valid
    expect(user.errors[:password]).to include("can't be blank")
  end

  it "rejects a password shorter than the minimum" do
    user = build(:user, password: "a" * (described_class::MINIMUM_PASSWORD_LENGTH - 1))

    expect(user).not_to be_valid
    expect(user.errors[:password]).to be_present
  end

  it "never stores the password itself" do
    user = create(:user, password: "correct horse battery")

    expect(user.password_digest).to be_present
    expect(user.password_digest).not_to include("correct horse battery")
  end

  # An address typed with a capital is the same account, so it is stored one way
  # and the unique index does the rest.
  it "downcases and strips the email" do
    user = create(:user, email: "  Akansha@Example.COM ")

    expect(user.email).to eq("akansha@example.com")
  end

  it "rejects a duplicate email regardless of case" do
    create(:user, email: "akansha@example.com")

    duplicate = build(:user, email: "AKANSHA@EXAMPLE.COM")

    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:email]).to include("has already been taken")
  end

  it "lets an existing user be saved without retyping the password" do
    user = create(:user)

    expect(user.update(name: "Renamed")).to be(true)
  end

  describe ".authenticate" do
    it "returns the user when the password is right" do
      user = create(:user, email: "akansha@example.com", password: "correct horse battery")

      expect(described_class.authenticate(email: "akansha@example.com",
                                          password: "correct horse battery")).to eq(user)
    end

    it "ignores how the email was typed" do
      user = create(:user, email: "akansha@example.com", password: "correct horse battery")

      expect(described_class.authenticate(email: " AKANSHA@Example.com ",
                                          password: "correct horse battery")).to eq(user)
    end

    it "returns nil when the password is wrong" do
      create(:user, email: "akansha@example.com", password: "correct horse battery")

      expect(described_class.authenticate(email: "akansha@example.com",
                                          password: "wrong")).to be_nil
    end

    it "returns nil when no such user exists" do
      expect(described_class.authenticate(email: "nobody@example.com",
                                          password: "correct horse battery")).to be_nil
    end
  end
end
