FactoryBot.define do
  factory :user do
    sequence(:name) { |n| "Akansha #{n}" }
    sequence(:email) { |n| "user#{n}@companymanager.test" }
    # Kept in step with AuthenticationHelpers::DEFAULT_PASSWORD, which is what
    # `sign_in` types at the login endpoint.
    password { "correct horse battery" }
  end
end
