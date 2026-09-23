module Api
  module V1
    # Shared CRUD for buyers and sellers, which differ only by STI class.
    # Subclasses supply `party_class`; everything else is identical.
    class PartiesController < ApplicationController
      protect_from_forgery with: :exception

      before_action :set_party, only: %i[update destroy]

      # Scoped to a company: /api/v1/buyers?company_id=1
      def index
        scope = party_class.where(company_id: params[:company_id]).includes(:bank_accounts).ordered
        render json: scope.map { |party| serialize(party) }
      end

      def create
        party = party_class.new(party_params)

        if party.save
          render json: serialize(party), status: :created
        else
          render json: { errors: party.errors.messages }, status: :unprocessable_content
        end
      end

      def update
        if @party.update(party_params)
          render json: serialize(@party)
        else
          render json: { errors: @party.errors.messages }, status: :unprocessable_content
        end
      end

      # Refused while the party is referenced by a sauda, so the register keeps
      # its history.
      def destroy
        if @party.destroy
          head :no_content
        else
          render json: { errors: @party.errors.messages }, status: :unprocessable_content
        end
      end

      private

      # Overridden by BuyersController / SellersController.
      def party_class
        raise NotImplementedError
      end

      # Fields only one of the two roles carries.
      def role_attributes
        []
      end

      def set_party
        @party = party_class.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { errors: { base: ["#{party_class.name} not found"] } }, status: :not_found
      end

      def party_params
        params.require(party_key).permit(
          :company_id, :name, :address, :email, :phone_no, :pan, :gst_registered,
          :gst_no, :trade_license_no, :food_license_no, *role_attributes,
          bank_accounts_attributes: %i[id bank_name branch account_number ifsc_code account_type _destroy]
        )
      end

      def party_key
        party_class.name.underscore.to_sym
      end

      def serialize(party)
        party.as_json(
          only: %i[id company_id name address email phone_no pan gst_registered gst_no
                   trade_license_no food_license_no created_at] + role_attributes,
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
