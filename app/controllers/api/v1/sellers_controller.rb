module Api
  module V1
    class SellersController < PartiesController
      private

      def party_class
        Seller
      end
    end
  end
end
