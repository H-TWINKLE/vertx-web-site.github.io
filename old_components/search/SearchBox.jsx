import classNames from "classnames"
import { useState, useRef } from "react"
import { Search, XCircle } from "react-feather"
import styles from "./SearchBox.scss?type=global"
import debounce from "lodash/debounce"

const SearchBox = ({ onChange, onSubmit, onNext, onPrev, autoSuggest }) => {
  const [content, setContent] = useState("")
  const debounceOnChange = useRef(onChange ? debounce(onChange, 10) : undefined)
  const inputRef = useRef()
  const [focus, setFocus] = useState()

  const doSetContent = (value) => {
    setContent(value)
    if (!value) {
      if (onChange) {
        onChange(value)
        debounceOnChange.current(value)
      }
    } else {
      if (debounceOnChange.current) {
        debounceOnChange.current(value)
      }
    }
  }

  const internalOnChange = (e) => {
    doSetContent(e.currentTarget.value)
  }

  const onKeyDown = (e) => {
    if (e.key === "Enter" && onSubmit) {
      onSubmit()
      e.preventDefault()
    } else if (e.key === "Escape") {
      onDelete()
      e.preventDefault()
    } else if (e.key === "ArrowDown" && onNext) {
      onNext()
      e.preventDefault()
    } else if (e.key === "ArrowUp" && onPrev) {
      onPrev()
      e.preventDefault()
    }
  }

  const onDelete = () => {
    doSetContent("")
    inputRef.current.focus()
  }

  return (
    <div className={classNames("search", { "has-content": content !== "" })}>
      <input type="text" placeholder={(focus && autoSuggest) || ""} className="autosuggest" disabled />
      <input type="text" placeholder="Search..." value={content}
          onChange={internalOnChange} onKeyDown={onKeyDown} onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)} ref={inputRef} />
      <Search className="search-icon" />
      <XCircle className="search-icon-delete" onClick={() => onDelete()} />
      <style jsx>{styles}</style>
    </div>
  )
}

export default SearchBox
