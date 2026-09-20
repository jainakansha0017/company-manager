FactoryBot.define do
  # Buyer and Seller share a table (STI), so they share one set of attributes.
  factory :party do
    transient do
      bank_account_count { 1 }
    end

    company
    sequence(:name) { |n| "Trading Partner #{n}" }
    address { "7 Camac Street, Kolkata 700017" }
    sequence(:email) { |n| "contact#{n}@partner.test" }
    phone_no { "+91 9820011223" }
    sequence(:pan) { |n| "PQRST#{format('%04d', n)}Z" }
    gst_registered { false }
    trade_license_no { "TL-2025-5501" }
    food_license_no { "FSSAI-99887766554433" }

    after(:build) do |party, evaluator|
      evaluator.bank_account_count.times do
        party.bank_accounts << build(:bank_account, accountable: party)
      end
    end

    trait :gst_registered do
      gst_registered { true }
      sequence(:gst_no) { |n| "19PQRST#{format('%04d', n)}Z1Z5" }
    end

    factory :buyer, class: "Buyer"
    factory :seller, class: "Seller"
  end
end
