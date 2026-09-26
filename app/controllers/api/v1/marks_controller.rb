module Api
  module V1
    class MarksController < ApplicationController
      protect_from_forgery with: :exception

      # Scoped to a seller: /api/v1/marks?seller_id=1
      # With no seller_id at all, every seller's marks come back — the sauda
      # form uses that to let a mark be picked before its seller is, and reads
      # the seller off whichever mark is chosen.
      def index
        scope = params[:seller_id].present? ? Mark.where(seller_id: params[:seller_id]) : Mark.all

        render json: scope.includes(:seller).ordered.map { |mark| serialize(mark) }
      end

      def create
        mark = Mark.new(mark_params)

        if mark.save
          render json: serialize(mark), status: :created
        else
          render json: { errors: mark.errors.messages }, status: :unprocessable_content
        end
      end

      # Refused while the mark is used on a sauda, so that sauda's history
      # keeps naming what it actually shipped under.
      def destroy
        mark = Mark.find(params[:id])

        if mark.destroy
          head :no_content
        else
          render json: { errors: mark.errors.messages }, status: :unprocessable_content
        end
      rescue ActiveRecord::RecordNotFound
        render json: { errors: { base: ["Mark not found"] } }, status: :not_found
      end

      private

      def mark_params
        params.require(:mark).permit(:seller_id, :name)
      end

      def serialize(mark)
        # The name alone is ambiguous once marks from every seller are on the
        # same list, since uniqueness is only scoped per seller.
        mark.as_json(only: %i[id seller_id name]).merge("seller_name" => mark.seller.name)
      end
    end
  end
end
