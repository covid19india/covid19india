import HeaderCell from './HeaderCell';
import TableLoader from './loaders/Table';
import {Delta7Icon, DistrictIcon, PerLakhIcon} from './snippets/Icons';
import TableDeltaHelper from './snippets/TableDeltaHelper';
import Tooltip from './Tooltip';

import {TABLE_FADE_IN, TABLE_FADE_OUT} from '../animations';
import {
  DISTRICT_TABLE_COUNT,
  STATE_NAMES,
  STATISTIC_CONFIGS,
  TABLE_STATISTICS,
  TABLE_STATISTICS_EXPANDED,
  UNASSIGNED_STATE_CODE,
} from '../constants';
import {getStatistic, retry} from '../utils/commonFunctions';

import {
  FoldDownIcon,
  InfoIcon,
  OrganizationIcon,
  PeopleIcon,
  PulseIcon,
  QuestionIcon,
  SortAscIcon,
  SortDescIcon,
} from '@primer/octicons-react';
import classnames from 'classnames';
import equal from 'fast-deep-equal';
import produce from 'immer';
import {memo, useCallback, useEffect, useMemo, useState, lazy} from 'react';
import {
  ChevronLeft,
  ChevronsLeft,
  ChevronRight,
  ChevronsRight,
} from 'react-feather';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {useTrail, useTransition, animated, config} from 'react-spring';
import {useKeyPressEvent, useMeasure, useSessionStorage} from 'react-use';
// eslint-disable-next-line
import worker from 'workerize-loader!../workers/getDistricts';

const Row = lazy(() => retry(() => import('./Row')));

function Table({
  data: states,
  date: timelineDate,
  regionHighlighted,
  setRegionHighlighted,
  expandTable,
  setExpandTable,
  hideDistrictData,
  hideDistrictTestData,
  hideVaccinated,
  lastDataDate,
  noDistrictDataStates,
}) {
  const {t} = useTranslation();
  const [sortData, setSortData] = useSessionStorage('sortData', {
    sortColumn: 'confirmed',
    isAscending: false,
    delta: false,
  });
  const [page, setPage] = useState(0);
  const [delta7Mode, setDelta7Mode] = useState(false);

  const [tableContainerRef, {width: tableWidth}] = useMeasure();

  const handleSortClick = useCallback(
    (statistic) => {
      if (sortData.sortColumn !== statistic) {
        setSortData(
          produce(sortData, (draftSortData) => {
            if (
              sortData.sortColumn === 'regionName' ||
              statistic === 'regionName'
            ) {
              draftSortData.isAscending = !sortData.isAscending;
            }
            draftSortData.sortColumn = statistic;
          })
        );
      } else {
        setSortData(
          produce(sortData, (draftSortData) => {
            draftSortData.isAscending = !sortData.isAscending;
          })
        );
      }
    },
    [sortData, setSortData]
  );

  const trail = useTrail(5, {
    from: {transform: 'translate3d(0, 10px, 0)', opacity: 0},
    to: {transform: 'translate3d(0, 0px, 0)', opacity: 1},
    config: config.wobbly,
  });

  const [allDistricts, setAllDistricts] = useState();

  const [tableOption, setTableOption] = useState('States');
  const [isPerLakh, setIsPerLakh] = useState(false);
  const [isInfoVisible, setIsInfoVisible] = useState(false);

  const getTableStatistic = useCallback(
    (data, statistic, type) => {
      const statisticConfig = STATISTIC_CONFIGS[statistic];
      if (type == 'total' && statisticConfig?.onlyDelta7) {
        type = 'delta7';
      }

      if (statisticConfig?.showDelta && type === 'total' && delta7Mode) {
        type = 'delta7';
      }

      return getStatistic(data, type, statistic, {
        expiredDate: lastDataDate,
        normalizedByPopulationPer: isPerLakh ? 'lakh' : null,
      });
    },
    [isPerLakh, lastDataDate, delta7Mode]
  );

  const districts = useMemo(() => {
    if (!isPerLakh) {
      return allDistricts;
    } else {
      return Object.keys(allDistricts || {})
        .filter(
          (districtKey) =>
            getStatistic(allDistricts[districtKey], 'total', 'population') > 0
        )
        .reduce((res, districtKey) => {
          res[districtKey] = allDistricts[districtKey];
          return res;
        }, {});
    }
  }, [isPerLakh, allDistricts]);

  const numPages = Math.ceil(
    Object.keys(districts || {}).length / DISTRICT_TABLE_COUNT
  );

  const sortingFunction = useCallback(
    (regionKeyA, regionKeyB) => {
      if (sortData.sortColumn !== 'regionName') {
        const statisticConfig = STATISTIC_CONFIGS[sortData.sortColumn];
        const dataType =
          sortData.delta && statisticConfig?.showDelta ? 'delta' : 'total';

        const statisticA = getTableStatistic(
          districts?.[regionKeyA] || states[regionKeyA],
          sortData.sortColumn,
          dataType
        );
        const statisticB = getTableStatistic(
          districts?.[regionKeyB] || states[regionKeyB],
          sortData.sortColumn,
          dataType
        );
        return sortData.isAscending
          ? statisticA - statisticB
          : statisticB - statisticA;
      } else {
        const regionNameA =
          districts?.[regionKeyA]?.districtName || STATE_NAMES[regionKeyA];
        const regionNameB =
          districts?.[regionKeyB]?.districtName || STATE_NAMES[regionKeyB];
        return sortData.isAscending
          ? regionNameA.localeCompare(regionNameB)
          : regionNameB.localeCompare(regionNameA);
      }
    },
    [
      districts,
      getTableStatistic,
      sortData.delta,
      sortData.isAscending,
      sortData.sortColumn,
      states,
    ]
  );

  const _setTableOption = useCallback(() => {
    setTableOption((prevTableOption) =>
      prevTableOption === 'States' ? 'Districts' : 'States'
    );
  }, []);

  useEffect(() => {
    const workerInstance = worker();
    workerInstance.getDistricts(states);
    workerInstance.addEventListener('message', (message) => {
      if (message.data.type !== 'RPC') {
        setAllDistricts(message.data);
        workerInstance.terminate();
      }
    });
  }, [tableOption, states]);

  useEffect(() => {
    setPage((p) => Math.max(0, Math.min(p, numPages - 1)));
  }, [numPages]);

  const handlePageClick = (direction) => {
    if (Math.abs(direction) === 1) {
      setPage(Math.min(Math.max(0, page + direction), numPages - 1));
    } else if (direction < 0) {
      setPage(0);
    } else if (direction > 0) {
      setPage(numPages - 1);
    }
  };

  const transition = useTransition(isInfoVisible, {
    from: TABLE_FADE_OUT,
    enter: TABLE_FADE_IN,
    leave: TABLE_FADE_OUT,
  });

  const tableStatistics = (
    expandTable ? TABLE_STATISTICS_EXPANDED : TABLE_STATISTICS
  ).filter(
    (statistic) =>
      (tableOption === 'States' ||
        STATISTIC_CONFIGS[statistic]?.category !== 'tested' ||
        !hideDistrictTestData) &&
      (STATISTIC_CONFIGS[statistic]?.category !== 'vaccinated' ||
        !hideVaccinated)
  );

  const showDistricts = tableOption === 'Districts' && !hideDistrictData;

  useEffect(() => {
    if (!showDistricts) {
      setPage(0);
    }
  }, [showDistricts]);

  useKeyPressEvent('?', () => {
    setIsInfoVisible(!isInfoVisible);
  });
  
  useEffect(() =>{
    let table = document.querySelector('.table-container>.table');
    let headers = document.querySelectorAll('.table-container>.table>.row.heading:first-child>.cell');
    
    // Set config values, set the special z indices for the header divs
    const stickBottomLimit = 150;
    const firstHeaderZ = 140;
    const otherHeaderZ = 120;
    headers.forEach((el, index)=>{
        el.style.zIndex = index==0 ? firstHeaderZ : otherHeaderZ;
    });

    // Build the handler that makes headers stick
    const handleScroll = ()=>{
        const rect = table.getBoundingClientRect();
        let offset = 0;
        if (rect.top < 0) {
            offset = Math.min(-rect.top, rect.height-stickBottomLimit);
        }
        headers.forEach((el)=>{
            el.style.transform = 'translateY('+offset+'px)';
        });
    };

    // Build debounced scroll listener
    let ticking = false;
    document.addEventListener('scroll', (e)=>{
        if (!ticking) {
            window.requestAnimationFrame(()=>{
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    });
  })

  return (
    <div className="Table">
      <div className="table-top">
        <div className="table-top-left">
          <Tooltip message={'Toggle between states/districts'} hold>
            <animated.div
              className={classnames('toggle', 'option-toggle', {
                'is-highlighted': showDistricts,
                disabled: hideDistrictData,
              })}
              onClick={_setTableOption}
              style={trail[0]}
            >
              <DistrictIcon />
            </animated.div>
          </Tooltip>

          <Tooltip message={'Per lakh people'} hold>
            <animated.div
              className={classnames('toggle', 'lakh-toggle', {
                'is-highlighted': isPerLakh,
              })}
              onClick={setIsPerLakh.bind(this, !isPerLakh)}
              style={trail[1]}
            >
              <PerLakhIcon />
            </animated.div>
          </Tooltip>

          <Tooltip message={'Last 7 day values'} hold>
            <animated.div
              className={classnames('toggle', 'delta-toggle', {
                'is-highlighted': delta7Mode,
              })}
              style={trail[2]}
              onClick={setDelta7Mode.bind(this, !delta7Mode)}
            >
              <Delta7Icon />
            </animated.div>
          </Tooltip>

          <animated.div
            className={classnames('toggle', 'info-toggle', {
              'is-highlighted': isInfoVisible,
            })}
            onClick={setIsInfoVisible.bind(this, !isInfoVisible)}
            style={trail[3]}
          >
            <QuestionIcon size={14} />
          </animated.div>
        </div>

        <Tooltip message={`${expandTable ? 'Collapse' : 'Expand'} table`} hold>
          <animated.div
            className={classnames('toggle', 'expand-table-toggle', {
              'is-highlighted': expandTable,
            })}
            style={trail[4]}
            onClick={setExpandTable.bind(this, !expandTable)}
          >
            <FoldDownIcon size={16} />
          </animated.div>
        </Tooltip>
      </div>

      {transition(
        (style, item) =>
          item && (
            <animated.div className="table-helper" {...{style}}>
              <div className="helper-top">
                <div className="helper-left">
                  <div className="info-item">
                    <div>
                      <OrganizationIcon size={14} />
                    </div>
                    <p>{t('Toggle between States/Districts')}</p>
                  </div>

                  <div className="info-item">
                    <div>
                      <PeopleIcon size={16} />
                    </div>
                    <p>{t('Per Lakh People')}</p>
                  </div>

                  <div className="info-item">
                    <div>
                      <PulseIcon size={16} />
                    </div>
                    <p>{t('Last 7 day values')}</p>
                  </div>

                  <div className="info-item sort">
                    <div>
                      <SortDescIcon size={14} />
                    </div>
                    <p>{t('Sorted by Descending')}</p>
                  </div>

                  <div className="info-item sort">
                    <div>
                      <SortAscIcon size={14} />
                    </div>
                    <p>{t('Sorted by Ascending')}</p>
                  </div>

                  <div className="info-item sort">
                    <TableDeltaHelper />
                  </div>

                  <div className="info-item notes">
                    <div>
                      <InfoIcon size={15} />
                    </div>
                    <p>{t('Notes')}</p>
                  </div>
                </div>

                <div className="helper-right">
                  <div className="info-item">
                    <p>{t('Units')}</p>
                  </div>
                  {Object.entries({'1K': 3, '1L': 5, '1Cr': 7}).map(
                    ([abbr, exp]) => (
                      <div className="info-item abbr" key={abbr}>
                        <h5>{abbr}</h5>
                        <p>
                          10
                          <sup>{exp}</sup>
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>

              <h5 className="text">
                {t('Compiled from State Govt. numbers')},{' '}
                <Link to="/about">{t('know more')}!</Link>
              </h5>
            </animated.div>
          )
      )}

      <div className="table-container" ref={tableContainerRef}>
        <div
          className="table fadeInUp"
          style={{
            gridTemplateColumns: `repeat(${tableStatistics.length + 1}, auto)`,
          }}
        >
          <div className="row heading">
            <div
              className="cell heading"
              onClick={handleSortClick.bind(this, 'regionName')}
            >
              <div>{t(!showDistricts ? 'State/UT' : 'District')}</div>
              {sortData.sortColumn === 'regionName' && (
                <div className={'sort-icon'}>
                  {sortData.isAscending ? (
                    <SortAscIcon size={12} />
                  ) : (
                    <SortDescIcon size={12} />
                  )}
                </div>
              )}
            </div>

            {tableStatistics.map((statistic) => (
              <HeaderCell
                key={statistic}
                {...{
                  statistic,
                  sortData,
                  setSortData,
                }}
                handleSort={handleSortClick.bind(this, statistic)}
              />
            ))}
          </div>

          {!showDistricts &&
            Object.keys(states)
              .filter(
                (stateCode) =>
                  stateCode !== 'TT' &&
                  !(stateCode === UNASSIGNED_STATE_CODE && isPerLakh)
              )
              .sort((a, b) => sortingFunction(a, b))
              .map((stateCode) => {
                return (
                  <Row
                    key={stateCode}
                    data={states[stateCode]}
                    noDistrictData={noDistrictDataStates[stateCode]}
                    {...{
                      stateCode,
                      regionHighlighted,
                      setRegionHighlighted,
                      expandTable,
                      tableStatistics,
                      getTableStatistic,
                      tableWidth,
                    }}
                  />
                );
              })}

          {showDistricts && !districts && <TableLoader />}

          {showDistricts &&
            districts &&
            Object.keys(districts)
              .sort((a, b) => sortingFunction(a, b))
              .slice(
                page * DISTRICT_TABLE_COUNT,
                (page + 1) * DISTRICT_TABLE_COUNT
              )
              .map((districtKey) => {
                const noDistrictData =
                  noDistrictDataStates[districts[districtKey].stateCode];
                return (
                  <Row
                    key={districtKey}
                    data={districts[districtKey]}
                    districtName={districts[districtKey].districtName}
                    {...{
                      regionHighlighted,
                      setRegionHighlighted,
                      expandTable,
                      tableStatistics,
                      getTableStatistic,
                      noDistrictData,
                    }}
                  />
                );
              })}

          <Row
            key={'TT'}
            data={states['TT']}
            stateCode={'TT'}
            {...{
              regionHighlighted,
              setRegionHighlighted,
              expandTable,
              tableStatistics,
              getTableStatistic,
            }}
          />
        </div>
      </div>
      {showDistricts && (
        <div className="paginate">
          <div
            className={classnames('left', {disabled: page === 0})}
            onClick={handlePageClick.bind(this, -2)}
          >
            <ChevronsLeft size={16} />
          </div>
          <div
            className={classnames('left', {disabled: page === 0})}
            onClick={handlePageClick.bind(this, -1)}
          >
            <ChevronLeft size={16} />
          </div>
          <h5>{`${page + 1} / ${numPages}`}</h5>
          <div
            className={classnames('right', {disabled: page === numPages - 1})}
            onClick={handlePageClick.bind(this, 1)}
          >
            <ChevronRight size={16} />
          </div>
          <div
            className={classnames('right', {disabled: page === numPages - 1})}
            onClick={handlePageClick.bind(this, 2)}
          >
            <ChevronsRight size={16} />
          </div>
        </div>
      )}
    </div>
  );
}

const isEqual = (prevProps, currProps) => {
  if (
    !equal(
      prevProps.regionHighlighted?.districtName,
      currProps.regionHighlighted?.districtName
    )
  ) {
    return false;
  } else if (
    !equal(
      prevProps.regionHighlighted?.stateCode,
      currProps.regionHighlighted?.stateCode
    )
  ) {
    return false;
  } else if (!equal(prevProps.date, currProps.date)) {
    return false;
  } else if (!equal(prevProps.hideDistrictData, currProps.hideDistrictData)) {
    return false;
  } else if (
    !equal(prevProps.hideDistrictTestData, currProps.hideDistrictTestData)
  ) {
    return false;
  } else if (!equal(prevProps.hideVaccinated, currProps.hideVaccinated)) {
    return false;
  } else if (!equal(prevProps.expandTable, currProps.expandTable)) {
    return false;
  } else if (!equal(prevProps.lastDataDate, currProps.lastDataDate)) {
    return false;
  } else if (
    !equal(
      prevProps.data['TT'].total.confirmed,
      currProps.data['TT'].total.confirmed
    )
  ) {
    return false;
  } else if (
    !equal(prevProps.noDistrictDataStates, currProps.noDistrictDataStates)
  ) {
    return false;
  } else return true;
};

export default memo(Table, isEqual);
