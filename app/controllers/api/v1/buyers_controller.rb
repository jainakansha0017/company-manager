module Api
  module V1
    class BuyersController < PartiesController
      private

      def party_class
        Buyer
      end
    end
  end
end
