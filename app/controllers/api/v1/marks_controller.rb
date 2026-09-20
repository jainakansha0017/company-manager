module Api
  module V1
    class MarksController < ApplicationController
      protect_from_forgery with: :exception

      # Scoped to a seller: /api/v1/marks?seller_id=1
      def index
        scope = Mark.where(seller_id: params[:seller_id]).ordered

        render json: scope.map { |mark| serialize(mark) }
      end

      def create
        mark = Mark.new(mark_params)

        if mark.save
          render json: serialize(mark), status: :created
        else
          render json: { errors: mark.errors.messages }, status: :unprocessable_content
        end
      end

      private

      def mark_params
        params.require(:mark).permit(:seller_id, :name)
      end

      def serialize(mark)
        mark.as_json(only: %i[id seller_id name])
      end
    end
  end
end
