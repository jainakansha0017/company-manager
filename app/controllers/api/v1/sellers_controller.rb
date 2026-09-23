module Api
  module V1
    class SellersController < PartiesController
      private

      def party_class
        Seller
      end

      # How this seller's broker is paid; buyers have no equivalent.
      def role_attributes
        %i[brokerage_basis]
      end
    end
  end
end
