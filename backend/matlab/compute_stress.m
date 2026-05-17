function stress = compute_stress(returns, window)
% COMPUTE_STRESS  Sectoral stress indicator from a returns matrix.
%
%   stress = COMPUTE_STRESS(returns, window) computes a composite financial
%   stress indicator from a matrix of sector returns.
%
%   Inputs
%   ------
%   returns : double matrix of size [T x N]
%       T rows of daily log-returns, N columns of sectors.
%       Rows are time-ordered (oldest first); NaNs not allowed.
%   window  : positive integer
%       Rolling-window length (in trading days) for volatility and
%       correlation estimation. Suggested default: 21 (~1 month).
%
%   Output
%   ------
%   stress  : struct with fields:
%       .dates_idx     [T x 1]   row indices of the input returns
%       .volatility    [T x N]   rolling std of each sector's returns
%       .avg_corr      [T x 1]   mean of off-diagonal pairwise corr matrix
%       .composite     [T x 1]   normalized composite stress indicator
%
%   The composite stress indicator is a simple weighted blend of
%   (a) the cross-sectional average of normalized rolling volatilities and
%   (b) the average pairwise correlation across sectors.
%   Rising values indicate higher systemic stress.
%
%   Example
%   -------
%   >> r = randn(252, 5) * 0.01;     % 1 year of fake daily returns, 5 sectors
%   >> s = compute_stress(r, 21);
%   >> plot(s.composite)

    % --- input validation ----------------------------------------------------
    arguments
        returns (:,:) double {mustBeFinite}
        window  (1,1) double {mustBePositive, mustBeInteger} = 21
    end

    [T, N] = size(returns);
    if T < window
        error("compute_stress:tooShort", ...
              "Need at least %d rows of returns; got %d.", window, T);
    end

    % --- rolling per-sector volatility --------------------------------------
    % movstd is built-in: rolling sample standard deviation with a centered
    % window by default; use trailing window for finance semantics.
    volatility = movstd(returns, [window-1, 0]);   % [T x N], trailing window

    % --- rolling average pairwise correlation -------------------------------
    % corr() requires the Statistics and Machine Learning Toolbox.
    % We compute correlation from cov() and std() (both in core MATLAB)
    % to keep this project toolbox-free.
    avg_corr = NaN(T, 1);
    for t = window:T
        win_returns = returns(t-window+1:t, :);     % [window x N]
        s = std(win_returns);                        % [1 x N] sample std
        C = cov(win_returns) ./ (s' * s);            % [N x N] correlation
        offdiag = C(triu(true(N), 1));               % upper-triangle, no diag
        avg_corr(t) = mean(offdiag);
    end

    % --- composite stress indicator -----------------------------------------
    % 1. cross-sectional average volatility, normalized to [0, 1] over the window
    mean_vol = mean(volatility, 2);                  % [T x 1], skip NaNs naturally
    mean_vol_norm = (mean_vol - min(mean_vol)) ./ ...
                    (max(mean_vol) - min(mean_vol) + eps);

    % 2. avg_corr normalized similarly (drop leading NaNs from the rolling step)
    valid = ~isnan(avg_corr);
    corr_norm = NaN(T, 1);
    corr_norm(valid) = (avg_corr(valid) - min(avg_corr(valid))) ./ ...
                       (max(avg_corr(valid)) - min(avg_corr(valid)) + eps);

    % 3. blend (60% volatility, 40% correlation — tune later)
    composite = 0.6 * mean_vol_norm + 0.4 * corr_norm;

    % --- assemble output struct ---------------------------------------------
    stress.dates_idx  = (1:T)';
    stress.volatility = volatility;
    stress.avg_corr   = avg_corr;
    stress.composite  = composite;
end
