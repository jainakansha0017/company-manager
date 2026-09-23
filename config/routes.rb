Rails.application.routes.draw do
  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      resources :companies, only: %i[index create update destroy]
      resources :buyers, only: %i[index create update destroy]
      resources :sellers, only: %i[index create update destroy]
      resources :saudas, only: %i[index show create update destroy]
      resources :marks, only: %i[index create]
    end
  end

  root "home#index"

  # Client-side routes: hand these back to the React app so a refresh or a
  # pasted link still works. Declared after the API namespace so /api is untouched.
  get "buyers", to: "home#index"
  get "buyers/*rest", to: "home#index"
  get "sellers", to: "home#index"
  get "sellers/*rest", to: "home#index"
  get "companies", to: "home#index"
  get "companies/*rest", to: "home#index"
end
