/* @flow */
import { findAll } from 'highlight-words-core'
import PropTypes from 'prop-types'
import { createElement } from 'react'
import memoizeOne from 'memoize-one'

Highlighter.propTypes = {
  activeClassName: PropTypes.string,
  activeIndex: PropTypes.number,
  activeStyle: PropTypes.object,
  autoEscape: PropTypes.bool,
  className: PropTypes.string,
  findChunks: PropTypes.func,
  highlightClassName: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.string
  ]),
  highlightStyle: PropTypes.object,
  highlightTag: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.func,
    PropTypes.string
  ]),
  sanitize: PropTypes.func,
  searchWords: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(RegExp)
    ])
  ).isRequired,
  categoryPerSearchWordIndex: PropTypes.arrayOf(PropTypes.string),
  highlightClassNamePerCategory: PropTypes.object,
  textToHighlight: PropTypes.string.isRequired,
  unhighlightClassName: PropTypes.string,
  unhighlightStyle: PropTypes.object
}

/**
 * Highlights all occurrences of search terms (searchText) within a string (textToHighlight).
 * This function returns an array of strings and <span>s (wrapping highlighted words).
 */
export default function Highlighter ({
  activeClassName = '',
  activeIndex = -1,
  activeStyle,
  autoEscape,
  caseSensitive = false,
  className,
  findChunks,
  highlightClassName = '',
  highlightStyle = {},
  highlightTag = 'mark',
  sanitize,
  searchWords,
  categoryPerSearchWordIndex,
  spans,
  categoryPerSpanIndex,
  highlightClassNamePerCategory,
  textToHighlight,
  unhighlightClassName = '',
  unhighlightStyle,
  ...rest
}) {
  const splitIntersectingChunks = (categoryPerSearchWordIndex && categoryPerSearchWordIndex.length > 0) ||
                                  (categoryPerSpanIndex && categoryPerSpanIndex.length > 0)
  const chunks = findAll({
    autoEscape,
    caseSensitive,
    findChunks,
    sanitize,
    searchWords,
    spans,
    textToHighlight,
    splitIntersectingChunks
  })
  const HighlightTag = highlightTag
  let highlightIndex = -1
  let highlightClassNames = ''
  let highlightStyles

  const lowercaseProps = object => {
    const mapped = {}
    for (let key in object) {
      mapped[key.toLowerCase()] = object[key]
    }
    return mapped
  }
  const memoizedLowercaseProps = memoizeOne(lowercaseProps)
  return createElement('span', {
    className,
    ...rest,
    children: chunks.map((chunk, index) => {
      const text = textToHighlight.substr(chunk.start, chunk.end - chunk.start)

      if (chunk.highlight) {
        highlightIndex++

        const isActive = highlightIndex === +activeIndex

        highlightStyles = isActive === true && activeStyle != null
          ? Object.assign({}, highlightStyle, activeStyle)
          : highlightStyle

        let props
        if (splitIntersectingChunks) {
          // TODO: Fix code duplication when I have time
          let categories = []
          const categoriesSortFunc = (first, second) => {
            const firstSplitIndex = first.indexOf('_')
            const secondSplitIndex = second.indexOf('_')

            const firstOrder = +first.substring(firstSplitIndex + 1)
            const firstName = first.substring(0, firstSplitIndex)
            const secondOrder = +second.substring(secondSplitIndex + 1)
            const secondName = second.substring(0, secondSplitIndex)

            if (!isNaN(firstOrder) && !isNaN(secondOrder)) {
              if (firstOrder !== secondOrder) {
                return firstOrder - secondOrder
              }
              return firstName.localeCompare(secondName)
            }
            return first.localeCompare(second)
          }

          if (chunk.searchWordsIndexes) {
            categories = chunk.searchWordsIndexes.reduce((categories_acc, searchWordIndex, index) => {
              const category = categoryPerSearchWordIndex[searchWordIndex]
              if (!categories_acc.includes(category)) {
                categories_acc.push(category)
              }
              return categories_acc
            }, categories).sort(categoriesSortFunc)
          }

          if (chunk.spansIndexes) {
            categories = chunk.spansIndexes.reduce((categories_acc, spanIndex, index) => {
              const category = categoryPerSpanIndex[spanIndex]
              if (!categories_acc.includes(category)) {
                categories_acc.push(category)
              }
              return categories_acc
            }, categories).sort(categoriesSortFunc)
          }

          const jointCategories = categories.join('-')
          let highlightClass = highlightClassNamePerCategory[jointCategories]

          if (highlightClass) {
            highlightClassNames = `${highlightClass} ${isActive ? activeClassName : ''}`

            props = {
              children: text,
              className: highlightClassNames,
              key: index,
              style: highlightStyles
            }
          } else {
            const paddingMultiplier = rest.paddingMultiplier !== undefined ? rest.paddingMultiplier : 2
            for (let i = categories.length - 1; i >= 0; i--) {
              const category = categories[i]
              const padding = (categories.length - 1 - i) * paddingMultiplier

              let children
              if (i === categories.length - 1) {
                children = text
              } else {
                children = createElement(HighlightTag, props)
              }

              highlightClass = highlightClassNamePerCategory[category]
              highlightClassNames = `${highlightClass} ${isActive ? activeClassName : ''}`

              props = {
                children,
                className: highlightClassNames,
                key: `${index}_${i}`,
                style: {...highlightStyles, 'paddingBottom': `${padding}px`}
              }
            }
          }
        } else {
          let highlightClass
          if (typeof highlightClassName === 'object') {
            if (!caseSensitive) {
              highlightClassName = memoizedLowercaseProps(highlightClassName)
              highlightClass = highlightClassName[text.toLowerCase()]
            } else {
              highlightClass = highlightClassName[text]
            }
          } else {
            highlightClass = highlightClassName
          }

          highlightClassNames = `${highlightClass} ${isActive ? activeClassName : ''}`

          props = {
            children: text,
            className: highlightClassNames,
            key: index,
            style: highlightStyles
          }
        }

        // Don't attach arbitrary props to DOM elements; this triggers React DEV warnings (https://fb.me/react-unknown-prop)
        // Only pass through the highlightIndex attribute for custom components.
        if (typeof HighlightTag !== 'string') {
          props.highlightIndex = highlightIndex
        }

        return createElement(HighlightTag, props)
      } else {
        return createElement('span', {
          children: text,
          className: unhighlightClassName,
          key: index,
          style: unhighlightStyle
        })
      }
    })
  })
}
