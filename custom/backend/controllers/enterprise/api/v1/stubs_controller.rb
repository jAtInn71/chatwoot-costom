module Enterprise
  module Api
    module V1
      class StubsController < ApplicationController
        # Return a minimal limits payload so the frontend doesn't crash.
        def limits
          render json: {
            id: params[:id],
            limits: {}
          }, status: :ok
        end

        # Generic no-op for enterprise POST endpoints.
        def noop
          render json: {}, status: :ok
        end
      end
    end
  end
end
