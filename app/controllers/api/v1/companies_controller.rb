module Api
  module V1
    class CompaniesController < ApplicationController
      # The React client sends JSON with the CSRF token from the page's meta tag.
      protect_from_forgery with: :exception

      before_action :set_company, only: %i[update destroy]

      def index
        companies = Company.includes(:bank_accounts).order(created_at: :desc)
        render json: companies.map { |company| serialize(company) }
      end

      def create
        company = Company.new(company_params)

        if company.save
          render json: serialize(company), status: :created
        else
          render json: { errors: company.errors.messages }, status: :unprocessable_content
        end
      end

      def update
        if @company.update(company_params)
          render json: serialize(@company)
        else
          render json: { errors: @company.errors.messages }, status: :unprocessable_content
        end
      end

      def destroy
        @company.destroy
        head :no_content
      end

      private

      def set_company
        @company = Company.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { errors: { base: ["Company not found"] } }, status: :not_found
      end

      def company_params
        params.require(:company).permit(
          :name, :address, :email, :phone_no, :pan, :gst_registered, :gst_no,
          :trade_license_no, :food_license_no, :financial_year,
          bank_accounts_attributes: %i[id bank_name branch account_number ifsc_code account_type _destroy]
        )
      end

      def serialize(company)
        company.as_json(
          only: %i[id name address email phone_no pan gst_registered gst_no
                   trade_license_no food_license_no financial_year created_at],
          include: {
            bank_accounts: {
              only: %i[id bank_name branch account_number ifsc_code account_type]
            }
          }
        )
      end
    end
  end
end
